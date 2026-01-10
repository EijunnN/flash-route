import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { optimizationJobs, optimizationConfigurations, drivers } from "@/db/schema";
import { withTenantFilter } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";
import { eq, and, desc } from "drizzle-orm";

function extractTenantContext(request: NextRequest) {
  const companyId = request.headers.get("x-company-id");
  const userId = request.headers.get("x-user-id");
  if (!companyId) return null;
  return { companyId, userId: userId || undefined };
}

// GET - Get monitoring summary for confirmed plans
export async function GET(request: NextRequest) {
  const tenantCtx = extractTenantContext(request);
  if (!tenantCtx) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 401 });
  }

  setTenantContext(tenantCtx);

  try {
    // Get the most recent confirmed optimization job for this company
    const confirmedJob = await db.query.optimizationJobs.findFirst({
      where: and(
        withTenantFilter(optimizationJobs),
        eq(optimizationJobs.status, "COMPLETED")
      ),
      with: {
        configuration: true,
      },
      orderBy: [desc(optimizationJobs.createdAt)],
    });

    if (!confirmedJob) {
      return NextResponse.json({
        data: {
          hasActivePlan: false,
          metrics: {
            totalDrivers: 0,
            driversInRoute: 0,
            driversAvailable: 0,
            driversOnPause: 0,
            completedStops: 0,
            totalStops: 0,
            completenessPercentage: 0,
            delayedStops: 0,
            activeAlerts: 0,
          },
        },
      });
    }

    // Parse the result
    let parsedResult = null;
    if (confirmedJob.result) {
      try {
        parsedResult = JSON.parse(confirmedJob.result);
      } catch {
        parsedResult = null;
      }
    }

    // Get all driver statuses from the company
    const allDrivers = await db.query.drivers.findMany({
      where: withTenantFilter(drivers),
      columns: {
        id: true,
        name: true,
        status: true,
        fleetId: true,
      },
    });

    // Count driver statuses
    const driversInRoute = allDrivers.filter((d) => d.status === "IN_ROUTE").length;
    const driversAvailable = allDrivers.filter((d) => d.status === "AVAILABLE").length;
    const driversOnPause = allDrivers.filter((d) => d.status === "ON_PAUSE").length;

    // Calculate route metrics from result
    let totalStops = 0;
    let routesCount = 0;

    if (parsedResult?.routes) {
      routesCount = parsedResult.routes.length;
      totalStops = parsedResult.routes.reduce((sum: number, route: any) => sum + (route.stops?.length || 0), 0);
    }

    // For now, we'll use mock data for completed stops and delays
    // In a real implementation, this would come from a stops table with actual status tracking
    const completedStops = Math.floor(totalStops * 0.4); // Mock: 40% completed
    const delayedStops = Math.floor(totalStops * 0.1); // Mock: 10% delayed
    const activeAlerts = driversInRoute > 0 ? Math.min(driversInRoute, 3) : 0; // Mock: some alerts

    const completenessPercentage = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

    return NextResponse.json({
      data: {
        hasActivePlan: true,
        jobId: confirmedJob.id,
        configurationId: confirmedJob.configurationId,
        configurationName: confirmedJob.configuration?.name,
        startedAt: confirmedJob.startedAt?.toISOString() || null,
        completedAt: confirmedJob.completedAt?.toISOString() || null,
        metrics: {
          totalDrivers: allDrivers.length,
          driversInRoute,
          driversAvailable,
          driversOnPause,
          completedStops,
          totalStops,
          completenessPercentage,
          delayedStops,
          activeAlerts,
        },
        result: parsedResult,
      },
    });
  } catch (error) {
    console.error("Error fetching monitoring summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch monitoring summary" },
      { status: 500 }
    );
  }
}
