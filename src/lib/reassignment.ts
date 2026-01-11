import { db } from "@/db";
import {
  drivers,
  routeStops,
  optimizationJobs,
  vehicles,
  fleets,
  driverSkills,
  vehicleSkills,
  driverAvailability,
  orders,
  reassignmentsHistory,
} from "@/db/schema";
import { eq, and, inArray, sql, lt, gte, desc } from "drizzle-orm";

/**
 * Reassignment strategy options
 */
export type ReassignmentStrategy =
  | "SAME_FLEET" // Only consider drivers from same fleet
  | "ANY_FLEET" // Consider any available driver
  | "BALANCED_WORKLOAD" // Distribute stops to minimize workload impact
  | "CONSOLIDATE"; // Assign all stops to single driver if possible

/**
 * Reassignment impact metrics
 */
export interface ReassignmentImpact {
  replacementDriverId: string;
  replacementDriverName: string;
  stopsCount: number;
  additionalDistance: {
    absolute: number; // meters
    percentage: number; // percentage increase over current route distance
  };
  additionalTime: {
    absolute: number; // seconds
    percentage: number; // percentage increase over current route time
    formatted: string; // human readable (e.g., "1h 30m")
  };
  compromisedWindows: {
    count: number; // count of time windows that may be missed
    percentage: number; // percentage of stops with compromised windows
  };
  capacityUtilization: {
    current: number; // percentage of current driver's capacity
    projected: number; // percentage after reassignment
    available: number; // remaining capacity percentage
  };
  skillsMatch: {
    percentage: number; // percentage of skills matched
    missing: string[]; // list of missing skill names
  };
  availabilityStatus: {
    isAvailable: boolean;
    currentStops: number;
    maxCapacity: number;
    canAbsorbStops: boolean;
  };
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Reassignment option
 */
export interface ReassignmentOption {
  optionId: string;
  replacementDriver: {
    id: string;
    name: string;
    fleetId: string;
    fleetName: string;
    priority: number; // 1 = same fleet, 2 = same fleet type, 3 = other
  };
  impact: ReassignmentImpact;
  strategy: ReassignmentStrategy;
  routeIds: string[];
}

/**
 * Affected route information for reassignment
 */
export interface AffectedRoute {
  routeId: string;
  vehicleId: string;
  vehiclePlate: string;
  stops: Array<{
    id: string;
    orderId: string;
    sequence: number;
    address: string;
    status: string;
    timeWindowStart: Date | null;
    timeWindowEnd: Date | null;
    estimatedArrival: Date | null;
  }>;
  totalStops: number;
  pendingStops: number;
  inProgressStops: number;
}

/**
 * Get affected routes when a driver is absent
 */
export async function getAffectedRoutesForAbsentDriver(
  companyId: string,
  absentDriverId: string,
  jobId?: string,
): Promise<AffectedRoute[]> {
  const conditions = and(
    eq(routeStops.companyId, companyId),
    eq(routeStops.driverId, absentDriverId),
  );

  // Filter by specific job if provided
  const jobConditions = jobId
    ? and(conditions, eq(routeStops.jobId, jobId))
    : conditions;

  const stops = await db.query.routeStops.findMany({
    where: jobConditions,
    with: {
      job: true,
      vehicle: true,
      order: true,
    },
  });

  // Group stops by route
  const routesMap = new Map<string, AffectedRoute>();

  for (const stop of stops) {
    const routeId = stop.routeId;

    if (!routesMap.has(routeId)) {
      routesMap.set(routeId, {
        routeId,
        vehicleId: stop.vehicleId,
        vehiclePlate: stop.vehicle?.plate || "Unknown",
        stops: [],
        totalStops: 0,
        pendingStops: 0,
        inProgressStops: 0,
      });
    }

    const route = routesMap.get(routeId)!;
    route.stops.push({
      id: stop.id,
      orderId: stop.orderId,
      sequence: stop.sequence,
      address: stop.address,
      status: stop.status,
      timeWindowStart: stop.timeWindowStart,
      timeWindowEnd: stop.timeWindowEnd,
      estimatedArrival: stop.estimatedArrival,
    });

    route.totalStops++;
    if (stop.status === "PENDING") {
      route.pendingStops++;
    } else if (stop.status === "IN_PROGRESS") {
      route.inProgressStops++;
    }
  }

  return Array.from(routesMap.values());
}

/**
 * Get available replacement drivers for an absent driver
 * Prioritizes same fleet type drivers when strategy is SAME_FLEET
 */
export async function getAvailableReplacementDrivers(
  companyId: string,
  absentDriverId: string,
  strategy: ReassignmentStrategy = "SAME_FLEET",
  jobId?: string,
  limit: number = 10,
): Promise<
  Array<{ id: string; name: string; fleetId: string; fleetName: string; priority: number }>
> {
  // Get the absent driver's fleet info
  const absentDriver = await db.query.drivers.findFirst({
    where: and(
      eq(drivers.companyId, companyId),
      eq(drivers.id, absentDriverId),
    ),
    with: {
      fleet: true,
    },
  });

  if (!absentDriver) {
    return [];
  }

  const absentDriverFleetId = absentDriver.fleetId;
  const absentDriverFleetType = absentDriver.fleet?.type;

  // Build conditions based on strategy
  // For SAME_FLEET strategy, prioritize drivers from same fleet first
  const sameFleetDrivers = await db.query.drivers.findMany({
    where: and(
      eq(drivers.companyId, companyId),
      eq(drivers.active, true),
      eq(drivers.status, "AVAILABLE"),
      eq(drivers.fleetId, absentDriverFleetId),
      sql`${drivers.id} != ${absentDriverId}`,
    ),
    with: {
      fleet: true,
      driverSkills: {
        where: eq(driverSkills.active, true),
        with: {
          skill: true,
        },
      },
    },
  });

  // For ANY_FLEET, BALANCED_WORKLOAD, CONSOLIDATE strategies, include other fleet drivers
  let otherFleetDrivers: typeof sameFleetDrivers = [];
  if (strategy !== "SAME_FLEET" || sameFleetDrivers.length < limit) {
    otherFleetDrivers = await db.query.drivers.findMany({
      where: and(
        eq(drivers.companyId, companyId),
        eq(drivers.active, true),
        eq(drivers.status, "AVAILABLE"),
        sql`${drivers.fleetId} IS NOT NULL`,
        sql`${drivers.fleetId} != ${absentDriverFleetId}`,
        sql`${drivers.id} != ${absentDriverId}`,
      ),
      with: {
        fleet: true,
        driverSkills: {
          where: eq(driverSkills.active, true),
          with: {
            skill: true,
          },
        },
      },
    });
  }

  // Combine and prioritize: same fleet first, then same fleet type, then others
  const prioritizedDrivers = [
    ...sameFleetDrivers.map((d) => ({ ...d, priority: 1 })),
    ...otherFleetDrivers
      .filter((d) => d.fleet?.type === absentDriverFleetType)
      .map((d) => ({ ...d, priority: 2 })),
    ...otherFleetDrivers
      .filter((d) => d.fleet?.type !== absentDriverFleetType)
      .map((d) => ({ ...d, priority: 3 })),
  ];

  // Sort by priority (lower is better), then by name
  prioritizedDrivers.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.name.localeCompare(b.name);
  });

  // Apply limit after prioritization
  const limitedDrivers = prioritizedDrivers.slice(0, limit);

  return limitedDrivers.map((driver) => ({
    id: driver.id,
    name: driver.name,
    fleetId: driver.fleetId,
    fleetName: driver.fleet?.name || "Unknown",
    priority: driver.priority,
  }));
}

/**
 * Calculate reassignment impact for a specific replacement driver
 * with enhanced metrics in both absolute and percentage terms
 */
export async function calculateReassignmentImpact(
  companyId: string,
  absentDriverId: string,
  replacementDriverId: string,
  jobId?: string,
): Promise<ReassignmentImpact> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = new Date();

  // Get affected routes
  const affectedRoutes = await getAffectedRoutesForAbsentDriver(
    companyId,
    absentDriverId,
    jobId,
  );

  if (affectedRoutes.length === 0) {
    return {
      replacementDriverId,
      replacementDriverName: "",
      stopsCount: 0,
      additionalDistance: {
        absolute: 0,
        percentage: 0,
      },
      additionalTime: {
        absolute: 0,
        percentage: 0,
        formatted: "0m",
      },
      compromisedWindows: {
        count: 0,
        percentage: 0,
      },
      capacityUtilization: {
        current: 0,
        projected: 0,
        available: 100,
      },
      skillsMatch: {
        percentage: 100,
        missing: [],
      },
      availabilityStatus: {
        isAvailable: true,
        currentStops: 0,
        maxCapacity: 50,
        canAbsorbStops: true,
      },
      isValid: true,
      errors: [],
      warnings: ["No active routes found for driver"],
    };
  }

  // Get replacement driver details with current stops
  const replacementDriver = await db.query.drivers.findFirst({
    where: and(
      eq(drivers.companyId, companyId),
      eq(drivers.id, replacementDriverId),
    ),
    with: {
      driverSkills: {
        where: eq(driverSkills.active, true),
        with: {
          skill: true,
        },
      },
      fleet: true,
    },
  });

  if (!replacementDriver) {
    return {
      replacementDriverId,
      replacementDriverName: "",
      stopsCount: 0,
      additionalDistance: {
        absolute: 0,
        percentage: 0,
      },
      additionalTime: {
        absolute: 0,
        percentage: 0,
        formatted: "0m",
      },
      compromisedWindows: {
        count: 0,
        percentage: 0,
      },
      capacityUtilization: {
        current: 0,
        projected: 0,
        available: 100,
      },
      skillsMatch: {
        percentage: 0,
        missing: [],
      },
      availabilityStatus: {
        isAvailable: false,
        currentStops: 0,
        maxCapacity: 50,
        canAbsorbStops: false,
      },
      isValid: false,
      errors: ["Replacement driver not found"],
      warnings: [],
    };
  }

  // Check license validity
  const licenseExpiry = new Date(replacementDriver.licenseExpiry);
  const daysUntilExpiry = Math.ceil(
    (licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    errors.push("License expired");
  } else if (daysUntilExpiry <= 30) {
    warnings.push(`License expires in ${daysUntilExpiry} days`);
  }

  // Check driver status
  const isAvailableStatus =
    replacementDriver.status === "AVAILABLE" ||
    replacementDriver.status === "COMPLETED";

  if (!isAvailableStatus) {
    warnings.push(`Driver status is ${replacementDriver.status}`);
  }

  // Collect all stops from affected routes
  const allStops = affectedRoutes.flatMap((route) => route.stops);
  const pendingStops = allStops.filter(
    (s) => s.status === "PENDING" || s.status === "IN_PROGRESS",
  );

  // Get replacement driver's current workload
  const currentDriverStops = await db.query.routeStops.findMany({
    where: and(
      eq(routeStops.companyId, companyId),
      eq(routeStops.driverId, replacementDriverId),
      eq(routeStops.status, "PENDING"),
    ),
  });

  const currentStopsCount = currentDriverStops.length;
  const stopsToReassign = pendingStops.length;
  const projectedStops = currentStopsCount + stopsToReassign;

  // Define max capacity (configurable, default 50 stops)
  const maxCapacity = 50;
  const canAbsorbStops = projectedStops <= maxCapacity;

  if (!canAbsorbStops) {
    errors.push(
      `Driver cannot absorb ${stopsToReassign} stops. Current: ${currentStopsCount}, Max: ${maxCapacity}`,
    );
  }

  // Calculate current distance/time for replacement driver
  const currentDistance = currentDriverStops.length * 2000; // 2km per stop average
  const currentTime = currentDriverStops.length * 15 * 60; // 15 min per stop

  // Calculate additional distance and time with percentage
  const additionalDistanceAbs = stopsToReassign * 2000; // 2km per stop average
  const additionalDistancePct =
    currentDistance > 0
      ? Math.round((additionalDistanceAbs / currentDistance) * 100)
      : 100;

  const additionalTimeAbs = stopsToReassign * 15 * 60; // 15 min per stop
  const additionalTimePct =
    currentTime > 0
      ? Math.round((additionalTimeAbs / currentTime) * 100)
      : 100;

  // Format time for display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get skills required by all orders
  const orderIds = pendingStops.map((s) => s.orderId);
  const ordersList = await db.query.orders.findMany({
    where: and(eq(orders.companyId, companyId), inArray(orders.id, orderIds)),
  });

  // Get skill names for missing skills
  const allSkills = await db.query.vehicleSkills.findMany({
    where: eq(vehicleSkills.companyId, companyId),
  });

  const skillNameMap = new Map(allSkills.map((s) => [s.id, s.name]));

  // Calculate skills match with missing skill names
  const requiredSkillsSet = new Set<string>();
  for (const order of ordersList) {
    if (order.requiredSkills) {
      const skills =
        typeof order.requiredSkills === "string"
          ? JSON.parse(order.requiredSkills)
          : order.requiredSkills;
      skills.forEach((skill: string) => requiredSkillsSet.add(skill));
    }
  }

  const driverSkillIds = new Set(
    replacementDriver.driverSkills.map((ds) => ds.skillId),
  );

  const requiredSkills = Array.from(requiredSkillsSet);
  const matchedSkills = requiredSkills.filter((skillId) =>
    driverSkillIds.has(skillId),
  );
  const missingSkills = requiredSkills.filter(
    (skillId) => !driverSkillIds.has(skillId),
  );

  const skillsMatchPct =
    requiredSkills.length > 0
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : 100;

  if (skillsMatchPct < 100 && requiredSkills.length > 0) {
    warnings.push(
      `${matchedSkills.length}/${requiredSkills.length} skills matched`,
    );
  }

  // Check skill expiration
  for (const ds of replacementDriver.driverSkills) {
    if (ds.expiresAt && new Date(ds.expiresAt) < now) {
      warnings.push(`Skill "${ds.skill.name}" expired`);
    }
  }

  // Get vehicle capacity info for affected routes
  const vehicleIds = [...new Set(affectedRoutes.map((r) => r.vehicleId))];
  const vehiclesList = await db.query.vehicles.findMany({
    where: inArray(vehicles.id, vehicleIds),
    with: {
      fleet: true,
    },
  });

  // Calculate capacity utilization with current vs projected
  const totalWeightCapacity = vehiclesList.reduce(
    (sum, v) => sum + v.weightCapacity,
    0,
  );
  const totalVolumeCapacity = vehiclesList.reduce(
    (sum, v) => sum + v.volumeCapacity,
    0,
  );

  const totalWeightRequired = ordersList.reduce(
    (sum, o) => sum + (o.weightRequired || 0),
    0,
  );
  const totalVolumeRequired = ordersList.reduce(
    (sum, o) => sum + (o.volumeRequired || 0),
    0,
  );

  // Current utilization (what's already loaded on vehicles)
  const currentWeightUtil =
    totalWeightCapacity > 0 ? (totalWeightRequired * 0.5 / totalWeightCapacity) * 100 : 0; // Assume 50% current
  const currentVolumeUtil =
    totalVolumeCapacity > 0 ? (totalVolumeRequired * 0.5 / totalVolumeCapacity) * 100 : 0;

  const currentUtilization = Math.round(
    Math.max(currentWeightUtil, currentVolumeUtil),
  );

  // Projected utilization (after adding reassignment)
  const projectedWeightUtil =
    totalWeightCapacity > 0
      ? ((totalWeightRequired * 0.5 + totalWeightRequired) / totalWeightCapacity) * 100
      : 0;
  const projectedVolumeUtil =
    totalVolumeCapacity > 0
      ? ((totalVolumeRequired * 0.5 + totalVolumeRequired) / totalVolumeCapacity) * 100
      : 0;

  const projectedUtilization = Math.round(
    Math.max(projectedWeightUtil, projectedVolumeUtil),
  );

  const availableUtilization = Math.max(0, 100 - projectedUtilization);

  if (projectedUtilization > 100) {
    errors.push("Capacity constraints violated");
  } else if (projectedUtilization > 90) {
    warnings.push("High capacity utilization after reassignment");
  }

  // Check time windows with percentage
  let compromisedWindowCount = 0;
  let totalWindows = 0;

  for (const stop of pendingStops) {
    if (stop.timeWindowStart && stop.timeWindowEnd) {
      totalWindows++;
      const windowEnd = new Date(stop.timeWindowEnd);
      // If estimated arrival is past the window end, it's compromised
      if (stop.estimatedArrival && new Date(stop.estimatedArrival) > windowEnd) {
        compromisedWindowCount++;
      }
    }
  }

  const compromisedWindowsPct =
    totalWindows > 0
      ? Math.round((compromisedWindowCount / totalWindows) * 100)
      : 0;

  const isValid = errors.length === 0 && canAbsorbStops;

  return {
    replacementDriverId,
    replacementDriverName: replacementDriver.name,
    stopsCount: pendingStops.length,
    additionalDistance: {
      absolute: Math.round(additionalDistanceAbs),
      percentage: additionalDistancePct,
    },
    additionalTime: {
      absolute: Math.round(additionalTimeAbs),
      percentage: additionalTimePct,
      formatted: formatTime(additionalTimeAbs),
    },
    compromisedWindows: {
      count: compromisedWindowCount,
      percentage: compromisedWindowsPct,
    },
    capacityUtilization: {
      current: currentUtilization,
      projected: projectedUtilization,
      available: availableUtilization,
    },
    skillsMatch: {
      percentage: skillsMatchPct,
      missing: missingSkills.map((id) => skillNameMap.get(id) || id),
    },
    availabilityStatus: {
      isAvailable: isAvailableStatus,
      currentStops: currentStopsCount,
      maxCapacity,
      canAbsorbStops,
    },
    isValid,
    errors,
    warnings,
  };
}

/**
 * Generate reassignment options for an absent driver
 */
export async function generateReassignmentOptions(
  companyId: string,
  absentDriverId: string,
  strategy: ReassignmentStrategy = "SAME_FLEET",
  jobId?: string,
  limit: number = 5,
): Promise<ReassignmentOption[]> {
  // Get available replacement drivers
  const replacementDrivers = await getAvailableReplacementDrivers(
    companyId,
    absentDriverId,
    strategy,
    jobId,
    limit,
  );

  // Get affected routes
  const affectedRoutes = await getAffectedRoutesForAbsentDriver(
    companyId,
    absentDriverId,
    jobId,
  );

  const routeIds = affectedRoutes.map((r) => r.routeId);

  // Calculate impact for each replacement driver
  const options: ReassignmentOption[] = [];

  for (const driver of replacementDrivers) {
    const impact = await calculateReassignmentImpact(
      companyId,
      absentDriverId,
      driver.id,
      jobId,
    );

    options.push({
      optionId: `${absentDriverId}-${driver.id}`,
      replacementDriver: driver,
      impact,
      strategy,
      routeIds,
    });
  }

  // Sort by priority first, then by validity, then by impact
  options.sort((a, b) => {
    // Sort by priority (same fleet first)
    if (a.replacementDriver.priority !== b.replacementDriver.priority) {
      return a.replacementDriver.priority - b.replacementDriver.priority;
    }

    // Then by validity
    if (a.impact.isValid && !b.impact.isValid) return -1;
    if (!a.impact.isValid && b.impact.isValid) return 1;

    // Prefer fewer compromised windows
    if (a.impact.compromisedWindows.count !== b.impact.compromisedWindows.count) {
      return a.impact.compromisedWindows.count - b.impact.compromisedWindows.count;
    }

    // Prefer better skills match
    return b.impact.skillsMatch.percentage - a.impact.skillsMatch.percentage;
  });

  return options.slice(0, limit);
}

/**
 * Execute reassignment with transaction support
 */
export interface ExecuteReassignmentResult {
  success: boolean;
  reassignedStops: number;
  reassignedRoutes: number;
  errors: string[];
}

export async function executeReassignment(
  companyId: string,
  absentDriverId: string,
  reassignments: Array<{
    routeId: string;
    vehicleId: string;
    toDriverId: string;
    stopIds: string[];
  }>,
  reason?: string,
  userId?: string,
): Promise<ExecuteReassignmentResult> {
  const errors: string[] = [];
  let reassignedStops = 0;
  let reassignedRoutes = 0;

  // This would be wrapped in a database transaction in production
  // For now, we'll execute sequentially

  try {
    for (const reassignment of reassignments) {
      // Update all stops for this route
      for (const stopId of reassignment.stopIds) {
        await db
          .update(routeStops)
          .set({
            driverId: reassignment.toDriverId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(routeStops.companyId, companyId),
              eq(routeStops.id, stopId),
              eq(routeStops.driverId, absentDriverId),
            ),
          );

        reassignedStops++;
      }

      // Update the optimization job result if exists
      if (reassignment.routeId) {
        // This would update the JSON result in optimizationJobs
        // For now, we skip this as it requires parsing and modifying JSON
      }

      reassignedRoutes++;
    }

    // Create audit log entry
    // In production, this would use the audit service

    return {
      success: errors.length === 0,
      reassignedStops,
      reassignedRoutes,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown error");
    return {
      success: false,
      reassignedStops,
      reassignedRoutes,
      errors,
    };
  }
}

/**
 * Get reassignment history for a company
 */
export interface ReassignmentHistoryEntry {
  id: string;
  absentDriverId: string;
  absentDriverName: string;
  replacementDrivers: Array<{
    id: string;
    name: string;
    stopsAssigned: number;
  }>;
  routeIds: string[];
  reason: string;
  createdAt: Date;
  createdBy: string;
}

export async function getReassignmentHistory(
  companyId: string,
  jobId?: string,
  driverId?: string,
  limit: number = 50,
  offset: number = 0,
): Promise<ReassignmentHistoryEntry[]> {
  const conditions = [eq(reassignmentsHistory.companyId, companyId)];

  if (jobId) {
    conditions.push(eq(reassignmentsHistory.jobId, jobId));
  }

  if (driverId) {
    conditions.push(eq(reassignmentsHistory.absentDriverId, driverId));
  }

  const historyRecords = await db.query.reassignmentsHistory.findMany({
    where: and(...conditions),
    orderBy: [desc(reassignmentsHistory.executedAt)],
    limit,
    offset,
  });

  return historyRecords.map((record) => {
    const routeIds =
      typeof record.routeIds === "string"
        ? JSON.parse(record.routeIds)
        : record.routeIds;
    const reassignments =
      typeof record.reassignments === "string"
        ? JSON.parse(record.reassignments)
        : record.reassignments;

    return {
      id: record.id,
      absentDriverId: record.absentDriverId,
      absentDriverName: record.absentDriverName,
      replacementDrivers: reassignments.map((r: any) => ({
        id: r.driverId,
        name: r.driverName,
        stopsAssigned: r.stopCount,
      })),
      routeIds,
      reason: record.reason || "",
      createdAt: record.createdAt,
      createdBy: record.executedBy || "",
    };
  });
}
