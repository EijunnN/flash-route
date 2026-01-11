import {
  calculateInputHash,
  canStartJob,
  registerJob,
  unregisterJob,
  setJobTimeout,
  cancelJob,
  updateJobProgress,
  completeJob,
  failJob,
  getCachedResult,
  isJobAborting,
} from "./job-queue";
import { db } from "@/db";
import { optimizationConfigurations, orders, vehicles, drivers, optimizationJobs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  assignDriversToRoutes,
  type DriverAssignmentRequest,
  DEFAULT_ASSIGNMENT_CONFIG,
  getAssignmentQualityMetrics,
  type DriverAssignmentResult,
} from "./driver-assignment";
import {
  calculateRouteDistance,
  calculateDistanceMatrix,
  type Coordinates,
} from "./geospatial";

// Optimization result types
export interface OptimizationStop {
  orderId: string;
  trackingId: string;
  sequence: number;
  address: string;
  latitude: string;
  longitude: string;
  estimatedArrival?: string;
  timeWindow?: {
    start: string;
    end: string;
  };
}

export interface OptimizationRoute {
  routeId: string;
  vehicleId: string;
  vehiclePlate: string;
  driverId?: string;
  driverName?: string;
  stops: OptimizationStop[];
  totalDistance: number;
  totalDuration: number;
  totalWeight: number;
  totalVolume: number;
  utilizationPercentage: number;
  timeWindowViolations: number;
  assignmentQuality?: {
    score: number;
    warnings: string[];
    errors: string[];
  };
}

export interface OptimizationResult {
  routes: OptimizationRoute[];
  unassignedOrders: Array<{
    orderId: string;
    trackingId: string;
    reason: string;
  }>;
  metrics: {
    totalDistance: number;
    totalDuration: number;
    totalRoutes: number;
    totalStops: number;
    utilizationRate: number;
    timeWindowComplianceRate: number;
  };
  assignmentMetrics?: {
    totalAssignments: number;
    assignmentsWithWarnings: number;
    assignmentsWithErrors: number;
    averageScore: number;
    skillCoverage: number;
    licenseCompliance: number;
    fleetAlignment: number;
    workloadBalance: number;
  };
  summary: {
    optimizedAt: string;
    objective: string;
    processingTimeMs: number;
  };
}

export interface OptimizationInput {
  configurationId: string;
  companyId: string;
  vehicleIds: string[];
  driverIds: string[];
}

/**
 * Run optimization with mock algorithm (placeholder for actual VRP solver)
 * In production, this would integrate with OR-Tools, Vroom, or similar
 */
export async function runOptimization(
  input: OptimizationInput,
  signal?: AbortSignal,
  jobId?: string
): Promise<OptimizationResult> {
  const startTime = Date.now();

  // Track partial results for cancellation
  let partialRoutes: OptimizationRoute[] = [];
  let partialUnassignedOrders: Array<{
    orderId: string;
    trackingId: string;
    reason: string;
  }> = [];

  // Check for abort signal
  const checkAbort = () => {
    if (signal?.aborted) {
      // Create partial results object
      const partialResult: OptimizationResult & { isPartial?: boolean } = {
        routes: partialRoutes,
        unassignedOrders: partialUnassignedOrders,
        metrics: {
          totalDistance: partialRoutes.reduce((sum, r) => sum + r.totalDistance, 0),
          totalDuration: partialRoutes.reduce((sum, r) => sum + r.totalDuration, 0),
          totalRoutes: partialRoutes.length,
          totalStops: partialRoutes.reduce((sum, r) => sum + r.stops.length, 0),
          utilizationRate: partialRoutes.length > 0
            ? partialRoutes.reduce((sum, r) => sum + r.utilizationPercentage, 0) / partialRoutes.length
            : 0,
          timeWindowComplianceRate: 100,
        },
        summary: {
          optimizedAt: new Date().toISOString(),
          objective: "DISTANCE",
          processingTimeMs: Date.now() - startTime,
        },
        isPartial: true,
      };
      // Store partial result globally for access during cancellation
      (globalThis as any).__partialOptimizationResult = partialResult;
      throw new Error("Optimization cancelled by user");
    }
  };

  checkAbort();

  // Fetch configuration
  const config = await db.query.optimizationConfigurations.findFirst({
    where: eq(optimizationConfigurations.id, input.configurationId),
  });

  if (!config) {
    throw new Error("Configuration not found");
  }

  checkAbort();

  // Fetch pending orders for this company
  const pendingOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.companyId, input.companyId),
      eq(orders.status, "PENDING"),
      eq(orders.active, true)
    ),
  });

  checkAbort();

  // Fetch selected vehicles
  const selectedVehicles = await db.query.vehicles.findMany({
    where: and(
      eq(vehicles.companyId, input.companyId),
      inArray(vehicles.id, input.vehicleIds),
      eq(vehicles.active, true)
    ),
    with: {
      fleet: true,
    },
  });

  checkAbort();

  // Fetch selected drivers
  const selectedDrivers = await db.query.drivers.findMany({
    where: and(
      eq(drivers.companyId, input.companyId),
      inArray(drivers.id, input.driverIds),
      eq(drivers.active, true)
    ),
  });

  checkAbort();

  // Mock optimization algorithm
  // In production, this would be replaced with actual VRP solving logic
  // using libraries like OR-Tools, Vroom, or a custom solver

  await updateJobProgress(jobId || input.configurationId, 10);
  checkAbort();

  // Simulate processing time
  await sleep(500);

  await updateJobProgress(jobId || input.configurationId, 30);
  checkAbort();

  await sleep(500);

  await updateJobProgress(jobId || input.configurationId, 50);
  checkAbort();

  await sleep(500);

  await updateJobProgress(jobId || input.configurationId, 70);
  checkAbort();

  // Generate mock routes based on available vehicles and orders
  const routes: OptimizationRoute[] = [];
  const unassignedOrders: Array<{
    orderId: string;
    trackingId: string;
    reason: string;
  }> = [];

  // Prepare route assignments for intelligent driver assignment
  let orderIndex = 0;
  const maxStopsPerRoute = Math.ceil(pendingOrders.length / selectedVehicles.length) || 1;
  const routeAssignments: DriverAssignmentRequest[] = [];
  const assignedDrivers = new Map<string, string>();

  // Build route assignments
  for (const vehicle of selectedVehicles) {
    checkAbort();

    const routeStops: OptimizationStop[] = [];

    // Assign orders to this route
    for (
      let i = 0;
      i < maxStopsPerRoute && orderIndex < pendingOrders.length;
      i++
    ) {
      const order = pendingOrders[orderIndex++];
      routeStops.push({
        orderId: order.id,
        trackingId: order.trackingId,
        sequence: i + 1,
        address: order.address,
        latitude: order.latitude,
        longitude: order.longitude,
        timeWindow: order.promisedDate
          ? {
              start: new Date(order.promisedDate).toISOString(),
              end: new Date(
                new Date(order.promisedDate).getTime() + 2 * 60 * 60 * 1000
              ).toISOString(),
            }
          : undefined,
      });
    }

    if (routeStops.length > 0) {
      // Store route stops for assignment
      routeAssignments.push({
        companyId: input.companyId,
        vehicleId: vehicle.id,
        routeStops: routeStops.map(s => ({
          orderId: s.orderId,
          promisedDate: s.timeWindow?.start ? new Date(s.timeWindow.start) : undefined,
        })),
        candidateDriverIds: selectedDrivers.map(d => d.id),
        assignedDrivers,
      });

      // Calculate real route distance using PostGIS (Story 17.1)
      const depotCoords: Coordinates = {
        latitude: parseFloat(config.depotLatitude),
        longitude: parseFloat(config.depotLongitude),
      };

      // Build route coordinates: depot -> all stops -> depot
      const routeCoordinates: Coordinates[] = [
        depotCoords,
        ...routeStops.map(stop => ({
          latitude: parseFloat(stop.latitude),
          longitude: parseFloat(stop.longitude),
        })),
        depotCoords, // Return to depot
      ];

      // Calculate actual distance using PostGIS
      const routeDistanceResult = await calculateRouteDistance(routeCoordinates);

      // Calculate total weight and volume from orders
      const routeOrderIds = routeStops.map(s => s.orderId);
      const routeOrders = pendingOrders.filter(o => routeOrderIds.includes(o.id));
      const totalWeight = routeOrders.reduce((sum, o) => sum + (o.weightRequired || 0), 0);
      const totalVolume = routeOrders.reduce((sum, o) => sum + (o.volumeRequired || 0), 0);

      // Create route with real distances from PostGIS
      const newRoute: OptimizationRoute = {
        routeId: `route-${vehicle.id}-${Date.now()}`,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        stops: routeStops,
        totalDistance: routeDistanceResult.distanceMeters, // Real distance from PostGIS
        totalDuration: routeDistanceResult.durationSeconds, // Estimated duration based on distance
        totalWeight,
        totalVolume,
        utilizationPercentage: Math.round(
          Math.max(
            (totalWeight / vehicle.weightCapacity) * 100,
            (totalVolume / vehicle.volumeCapacity) * 100
          ) || (routeStops.length / maxStopsPerRoute) * 100
        ),
        timeWindowViolations: 0,
      };
      routes.push(newRoute);
      // Update partial results tracking
      partialRoutes = [...routes];
    }
  }

  // Perform intelligent driver assignment
  checkAbort();
  const driverAssignments = await assignDriversToRoutes(
    routeAssignments,
    {
      ...DEFAULT_ASSIGNMENT_CONFIG,
      strategy: (config?.objective as any) || "BALANCED",
    }
  );

  // Update routes with assigned drivers
  for (const route of routes) {
    const assignment = driverAssignments.get(route.vehicleId);
    if (assignment) {
      route.driverId = assignment.driverId;
      route.driverName = assignment.driverName;
      route.assignmentQuality = {
        score: assignment.score.score,
        warnings: assignment.score.warnings,
        errors: assignment.score.errors,
      };
    }
  }

  // Remaining orders are unassigned
  while (orderIndex < pendingOrders.length) {
    const order = pendingOrders[orderIndex++];
    unassignedOrders.push({
      orderId: order.id,
      trackingId: order.trackingId,
      reason: "No available vehicles or capacity constraints",
    });
  }

  await updateJobProgress(jobId || input.configurationId, 90);
  checkAbort();

  await sleep(300);

  // Calculate aggregate metrics
  const totalDistance = routes.reduce((sum, r) => sum + r.totalDistance, 0);
  const totalDuration = routes.reduce((sum, r) => sum + r.totalDuration, 0);
  const totalStops = routes.reduce((sum, r) => sum + r.stops.length, 0);
  const timeWindowViolations = routes.reduce(
    (sum, r) => sum + r.timeWindowViolations,
    0
  );

  const utilizationRate =
    routes.length > 0
      ? routes.reduce((sum, r) => sum + r.utilizationPercentage, 0) / routes.length
      : 0;

  const timeWindowComplianceRate =
    totalStops > 0
      ? ((totalStops - timeWindowViolations) / totalStops) * 100
      : 100;

  // Calculate assignment quality metrics
  const assignmentResults: DriverAssignmentResult[] = routes
    .filter((r) => r.assignmentQuality)
    .map((r) => ({
      driverId: r.driverId!,
      driverName: r.driverName!,
      score: {
        driverId: r.driverId!,
        score: r.assignmentQuality!.score,
        factors: {
          skillsMatch: 100, // Placeholder - not tracked per route
          availability: 100,
          licenseValid: 100,
          fleetMatch: 100,
          workload: 100,
        },
        warnings: r.assignmentQuality!.warnings,
        errors: r.assignmentQuality!.errors,
      },
      isManualOverride: false,
    }));

  const assignmentMetrics = await getAssignmentQualityMetrics(assignmentResults);

  const result: OptimizationResult = {
    routes,
    unassignedOrders,
    metrics: {
      totalDistance,
      totalDuration,
      totalRoutes: routes.length,
      totalStops,
      utilizationRate: Math.round(utilizationRate),
      timeWindowComplianceRate: Math.round(timeWindowComplianceRate),
    },
    assignmentMetrics,
    summary: {
      optimizedAt: new Date().toISOString(),
      objective: config.objective,
      processingTimeMs: Date.now() - startTime,
    },
  };

  await updateJobProgress(jobId || input.configurationId, 100);
  checkAbort();

  return result;
}

/**
 * Sleep utility for simulating async work
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create and execute an optimization job
 */
export async function createAndExecuteJob(
  input: OptimizationInput,
  timeoutMs: number = 300000 // 5 minutes default
): Promise<{ jobId: string; cached: boolean }> {
  // Calculate input hash for caching
  const pendingOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.companyId, input.companyId),
      eq(orders.status, "PENDING"),
      eq(orders.active, true)
    ),
  });

  const inputHash = calculateInputHash(
    input.configurationId,
    input.vehicleIds,
    input.driverIds,
    pendingOrders.map((o) => o.id)
  );

  // Check for cached results
  const cachedResult = await getCachedResult(inputHash, input.companyId);
  if (cachedResult) {
    // Return cached job without creating a new one
    // The caller should look up the cached job by inputHash
    const cachedJob = await db.query.optimizationJobs.findFirst({
      where: and(
        eq(optimizationJobs.inputHash, inputHash),
        eq(optimizationJobs.companyId, input.companyId),
        eq(optimizationJobs.status, "COMPLETED")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    if (cachedJob) {
      return { jobId: cachedJob.id, cached: true };
    }
  }

  // Check concurrency limit
  if (!canStartJob()) {
    throw new Error("Maximum concurrent jobs reached. Please try again later.");
  }

  // Create abort controller for this job
  const abortController = new AbortController();

  // Create new job in database
  const [newJob] = await db
    .insert(optimizationJobs)
    .values({
      companyId: input.companyId,
      configurationId: input.configurationId,
      status: "PENDING",
      inputHash,
      timeoutMs,
    })
    .returning();

  const jobId = newJob.id;

  // Register job in queue
  registerJob(jobId, abortController);

  // Set timeout
  setJobTimeout(jobId, timeoutMs, async () => {
    await failJob(jobId, "Optimization timed out");
  });

  // Execute optimization asynchronously
  (async () => {
    try {
      // Update job status to running
      await db
        .update(optimizationJobs)
        .set({ status: "RUNNING", startedAt: new Date() })
        .where(eq(optimizationJobs.id, jobId));

      // Run optimization
      const result = await runOptimization(input, abortController.signal, jobId);

      // Complete job
      await completeJob(jobId, result);
    } catch (error) {
      if (isJobAborting(jobId)) {
        // Get partial results if available
        const partialResults = (globalThis as any).__partialOptimizationResult;
        await cancelJob(jobId, partialResults);
        // Clean up global state
        delete (globalThis as any).__partialOptimizationResult;
      } else {
        await failJob(
          jobId,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  })();

  return { jobId, cached: false };
}
