import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, fleets, optimizationJobs } from "@/db/schema";
import { withTenantFilter } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";
import { eq, and, desc, sql } from "drizzle-orm";

function extractTenantContext(request: NextRequest) {
  const companyId = request.headers.get("x-company-id");
  const userId = request.headers.get("x-user-id");
  if (!companyId) return null;
  return { companyId, userId: userId || undefined };
}

// GET - Get all drivers with their monitoring status
export async function GET(request: NextRequest) {
  const tenantCtx = extractTenantContext(request);
  if (!tenantCtx) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 401 });
  }

  setTenantContext(tenantCtx);

  try {
    // Get the most recent confirmed optimization job
    const confirmedJob = await db.query.optimizationJobs.findFirst({
      where: and(
        withTenantFilter(optimizationJobs),
        eq(optimizationJobs.status, "COMPLETED")
      ),
      orderBy: [desc(optimizationJobs.createdAt)],
    });

    // Parse routes from job result
    let routesByDriver = new Map<string, any>();
    if (confirmedJob?.result) {
      try {
        const parsedResult = JSON.parse(confirmedJob.result);
        if (parsedResult?.routes) {
          parsedResult.routes.forEach((route: any) => {
            if (route.driverId) {
              routesByDriver.set(route.driverId, route);
            }
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Get all drivers with their fleet info
    const allDrivers = await db.query.drivers.findMany({
      where: withTenantFilter(drivers),
      with: {
        fleet: true,
      },
    });

    // Build driver monitoring data
    const driverMonitoringData = allDrivers.map((driver) => {
      const route = routesByDriver.get(driver.id);
      const totalStops = route?.stops?.length || 0;
      const completedStops = Math.floor(totalStops * 0.5); // Mock: 50% completed

      return {
        id: driver.id,
        name: driver.name,
        status: driver.status,
        fleetId: driver.fleetId,
        fleetName: driver.fleet?.name || "Unknown",
        hasRoute: !!route,
        routeId: route?.routeId || null,
        vehiclePlate: route?.vehiclePlate || null,
        progress: {
          completedStops,
          totalStops,
          percentage: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
        },
        alerts: getDriverAlerts(driver, route),
      };
    });

    // Sort drivers: those with routes first, then by status
    driverMonitoringData.sort((a, b) => {
      if (a.hasRoute && !b.hasRoute) return -1;
      if (!a.hasRoute && b.hasRoute) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      data: driverMonitoringData,
    });
  } catch (error) {
    console.error("Error fetching driver monitoring data:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver monitoring data" },
      { status: 500 }
    );
  }
}

function getDriverAlerts(driver: any, route: any): string[] {
  const alerts: string[] = [];

  // Check for license expiry
  if (driver.licenseExpiry) {
    const expiryDate = new Date(driver.licenseExpiry);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 30) {
      alerts.push(`License expires in ${daysUntilExpiry} days`);
    }
  }

  // Check for route delays
  if (route?.timeWindowViolations && route.timeWindowViolations > 0) {
    alerts.push(`${route.timeWindowViolations} time window violations`);
  }

  // Check for driver status issues
  if (driver.status === "ABSENT") {
    alerts.push("Driver marked as absent");
  }

  return alerts;
}
