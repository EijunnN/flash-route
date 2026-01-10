import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, fleets, vehicles } from "@/db/schema";
import { withTenantFilter } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";
import { eq, and, desc } from "drizzle-orm";

function extractTenantContext(request: NextRequest) {
  const companyId = request.headers.get("x-company-id");
  const userId = request.headers.get("x-user-id");
  if (!companyId) return null;
  return { companyId, userId: userId || undefined };
}

// GET - Get detailed route information for a specific driver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantCtx = extractTenantContext(request);
  if (!tenantCtx) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 401 });
  }

  setTenantContext(tenantCtx);
  const { id: driverId } = await params;

  try {
    // Get driver details
    const driver = await db.query.drivers.findFirst({
      where: and(
        eq(drivers.id, driverId),
        withTenantFilter(drivers)
      ),
      with: {
        fleet: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Get the most recent confirmed optimization job
    const confirmedJob = await db.query.optimizationJobs.findFirst({
      where: and(
        withTenantFilter(sql`${optimizationJobs}`),
        eq(optimizationJobs.status, "COMPLETED")
      ),
      orderBy: [desc(optimizationJobs.createdAt)],
    });

    let routeData = null;
    let vehicleData = null;

    if (confirmedJob?.result) {
      try {
        const parsedResult = JSON.parse(confirmedJob.result);
        const route = parsedResult?.routes?.find((r: any) => r.driverId === driverId);

        if (route) {
          // Get vehicle details
          vehicleData = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, route.vehicleId),
          });

          // Build route data with stops
          routeData = {
            routeId: route.routeId,
            vehicle: {
              id: route.vehicleId,
              plate: route.vehiclePlate,
              brand: vehicleData?.brand || "Unknown",
              model: vehicleData?.model || "Unknown",
            },
            metrics: {
              totalDistance: route.totalDistance,
              totalDuration: route.totalDuration,
              totalWeight: route.totalWeight,
              totalVolume: route.totalVolume,
              utilizationPercentage: route.utilizationPercentage,
              timeWindowViolations: route.timeWindowViolations,
            },
            stops: route.stops.map((stop: any, index: number) => ({
              ...stop,
              status: getStopStatus(index, route.stops.length), // Mock status based on position
              estimatedArrival: stop.estimatedArrival || calculateEstimatedArrival(index),
              completedAt: index < Math.floor(route.stops.length * 0.5) ? new Date().toISOString() : null,
            })),
            assignmentQuality: route.assignmentQuality,
          };
        }
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      data: {
        driver: {
          id: driver.id,
          name: driver.name,
          status: driver.status,
          identification: driver.identification,
          email: driver.email,
          phone: driver.phone,
          fleet: {
            id: driver.fleet?.id,
            name: driver.fleet?.name,
            type: driver.fleet?.type,
          },
        },
        route: routeData,
      },
    });
  } catch (error) {
    console.error("Error fetching driver route detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver route detail" },
      { status: 500 }
    );
  }
}

// Mock stop status based on position in route
function getStopStatus(index: number, totalStops: number): string {
  const completedThreshold = Math.floor(totalStops * 0.5);
  if (index < completedThreshold) return "COMPLETED";
  if (index === completedThreshold) return "IN_PROGRESS";
  return "PENDING";
}

// Mock estimated arrival calculation
function calculateEstimatedArrival(index: number): string {
  const baseTime = Date.now();
  const minutesPerStop = 15;
  return new Date(baseTime + index * minutesPerStop * 60 * 1000).toISOString();
}

// Import optimizationJobs
import { optimizationJobs } from "@/db/schema";
import { sql } from "drizzle-orm";
