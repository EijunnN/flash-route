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
  additionalDistance: number; // meters
  additionalTime: number; // seconds
  compromisedWindows: number; // count of time windows that may be missed
  capacityUtilization: number; // percentage
  skillsMatch: number; // percentage
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
 */
export async function getAvailableReplacementDrivers(
  companyId: string,
  absentDriverId: string,
  strategy: ReassignmentStrategy = "SAME_FLEET",
  jobId?: string,
  limit: number = 10,
): Promise<
  Array<{ id: string; name: string; fleetId: string; fleetName: string }>
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

  // Build conditions based on strategy
  let fleetCondition;
  if (strategy === "SAME_FLEET") {
    fleetCondition = eq(drivers.fleetId, absentDriver.fleetId);
  }

  // Get available drivers (exclude absent driver and unavailable ones)
  const availableDrivers = await db.query.drivers.findMany({
    where: and(
      eq(drivers.companyId, companyId),
      eq(drivers.active, true),
      eq(drivers.status, "AVAILABLE"),
      fleetCondition || sql`${drivers.fleetId} IS NOT NULL`,
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
    limit: limit,
  });

  return availableDrivers.map((driver) => ({
    id: driver.id,
    name: driver.name,
    fleetId: driver.fleetId,
    fleetName: driver.fleet?.name || "Unknown",
  }));
}

/**
 * Calculate reassignment impact for a specific replacement driver
 */
export async function calculateReassignmentImpact(
  companyId: string,
  absentDriverId: string,
  replacementDriverId: string,
  jobId?: string,
): Promise<ReassignmentImpact> {
  const errors: string[] = [];
  const warnings: string[] = [];

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
      additionalDistance: 0,
      additionalTime: 0,
      compromisedWindows: 0,
      capacityUtilization: 0,
      skillsMatch: 0,
      isValid: true,
      errors: [],
      warnings: ["No active routes found for driver"],
    };
  }

  // Get replacement driver details
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
    },
  });

  if (!replacementDriver) {
    return {
      replacementDriverId,
      replacementDriverName: "",
      stopsCount: 0,
      additionalDistance: 0,
      additionalTime: 0,
      compromisedWindows: 0,
      capacityUtilization: 0,
      skillsMatch: 0,
      isValid: false,
      errors: ["Replacement driver not found"],
      warnings: [],
    };
  }

  // Check license validity
  const now = new Date();
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
  if (
    replacementDriver.status !== "AVAILABLE" &&
    replacementDriver.status !== "COMPLETED"
  ) {
    warnings.push(`Driver status is ${replacementDriver.status}`);
  }

  // Collect all stops and orders
  const allStops = affectedRoutes.flatMap((route) => route.stops);
  const pendingStops = allStops.filter(
    (s) => s.status === "PENDING" || s.status === "IN_PROGRESS",
  );

  // Get skills required by all orders
  const orderIds = pendingStops.map((s) => s.orderId);
  const ordersList = await db.query.orders.findMany({
    where: and(eq(orders.companyId, companyId), inArray(orders.id, orderIds)),
  });

  // Calculate skills match
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

  const skillsMatch =
    requiredSkills.length > 0
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : 100;

  if (skillsMatch < 100 && requiredSkills.length > 0) {
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

  // Get vehicle capacity info
  const vehicleIds = [...new Set(affectedRoutes.map((r) => r.vehicleId))];
  const vehiclesList = await db.query.vehicles.findMany({
    where: inArray(vehicles.id, vehicleIds),
    with: {
      fleet: true,
    },
  });

  // Calculate capacity utilization (estimate)
  const totalWeightCapacity = vehiclesList.reduce(
    (sum, v) => sum + v.weightCapacity,
    0,
  );
  const totalVolumeCapacity = vehiclesList.reduce(
    (sum, v) => sum + v.volumeCapacity,
    0,
  );

  // Get order requirements
  const totalWeightRequired = ordersList.reduce(
    (sum, o) => sum + (o.weightRequired || 0),
    0,
  );
  const totalVolumeRequired = ordersList.reduce(
    (sum, o) => sum + (o.volumeRequired || 0),
    0,
  );

  const weightUtilization =
    totalWeightCapacity > 0
      ? (totalWeightRequired / totalWeightCapacity) * 100
      : 0;
  const volumeUtilization =
    totalVolumeCapacity > 0
      ? (totalVolumeRequired / totalVolumeCapacity) * 100
      : 0;

  const capacityUtilization = Math.max(weightUtilization, volumeUtilization);

  if (capacityUtilization > 100) {
    errors.push("Capacity constraints violated");
  }

  // Calculate estimated additional time and distance
  // This is a simplified calculation - in production, you would use actual routing engine
  const pendingStopsCount = pendingStops.length;
  const additionalTime = pendingStopsCount * 15 * 60; // 15 minutes per stop in seconds
  const additionalDistance = pendingStopsCount * 2000; // 2km per stop average in meters

  // Check time windows
  let compromisedWindows = 0;
  for (const stop of pendingStops) {
    if (stop.timeWindowStart && stop.timeWindowEnd) {
      // Check if the estimated arrival would be outside the window
      // This is a simplified check
      const now = new Date();
      if (stop.estimatedArrival && new Date(stop.estimatedArrival) < now) {
        compromisedWindows++;
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    replacementDriverId,
    replacementDriverName: replacementDriver.name,
    stopsCount: pendingStops.length,
    additionalDistance: Math.round(additionalDistance),
    additionalTime: Math.round(additionalTime),
    compromisedWindows,
    capacityUtilization: Math.round(capacityUtilization),
    skillsMatch,
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

  // Sort by validity first, then by impact
  options.sort((a, b) => {
    if (a.impact.isValid && !b.impact.isValid) return -1;
    if (!a.impact.isValid && b.impact.isValid) return 1;

    // Prefer fewer compromised windows
    if (a.impact.compromisedWindows !== b.impact.compromisedWindows) {
      return a.impact.compromisedWindows - b.impact.compromisedWindows;
    }

    // Prefer better skills match
    return b.impact.skillsMatch - a.impact.skillsMatch;
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
