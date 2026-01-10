import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleets, vehicles } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { withTenantFilter, TenantAccessDeniedError } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";

function extractTenantContext(request: NextRequest) {
  const companyId = request.headers.get("x-company-id");
  const userId = request.headers.get("x-user-id");

  if (!companyId) {
    return null;
  }

  return {
    companyId,
    userId: userId || undefined,
  };
}

/**
 * GET /api/fleets/[id]/vehicle-counts
 * Returns vehicle counts grouped by status for a specific fleet
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantCtx = extractTenantContext(request);
    if (!tenantCtx) {
      return NextResponse.json(
        { error: "Missing tenant context" },
        { status: 401 }
      );
    }

    setTenantContext(tenantCtx);

    const { id } = await params;

    // Verify the fleet exists and belongs to the tenant's company
    const fleetWhereClause = withTenantFilter(fleets, [eq(fleets.id, id)]);
    const [fleet] = await db
      .select()
      .from(fleets)
      .where(fleetWhereClause)
      .limit(1);

    if (!fleet) {
      return NextResponse.json(
        { error: "Fleet not found" },
        { status: 404 }
      );
    }

    // Get vehicle counts by status for this fleet
    const statusCounts = await db
      .select({
        status: vehicles.status,
        count: count(),
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.fleetId, id),
          eq(vehicles.companyId, tenantCtx.companyId),
          eq(vehicles.active, true)
        )
      )
      .groupBy(vehicles.status);

    // Get total vehicles count
    const [totalResult] = await db
      .select({ count: count() })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.fleetId, id),
          eq(vehicles.companyId, tenantCtx.companyId),
          eq(vehicles.active, true)
        )
      );

    // Calculate utilization metrics
    const assignedCount = statusCounts.find((c) => c.status === "ASSIGNED")?.count || 0;
    const availableCount = statusCounts.find((c) => c.status === "AVAILABLE")?.count || 0;
    const inMaintenanceCount = statusCounts.find((c) => c.status === "IN_MAINTENANCE")?.count || 0;
    const inactiveCount = statusCounts.find((c) => c.status === "INACTIVE")?.count || 0;

    const totalVehicles = totalResult.count;
    const utilizationRate = totalVehicles > 0
      ? Math.round((assignedCount / totalVehicles) * 100)
      : 0;

    return NextResponse.json({
      fleet: {
        id: fleet.id,
        name: fleet.name,
        type: fleet.type,
      },
      counts: {
        total: totalVehicles,
        byStatus: {
          AVAILABLE: availableCount,
          IN_MAINTENANCE: inMaintenanceCount,
          ASSIGNED: assignedCount,
          INACTIVE: inactiveCount,
        },
        utilizationRate,
      },
    });
  } catch (error) {
    console.error("Error fetching fleet vehicle counts:", error);
    if (error instanceof TenantAccessDeniedError) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Error fetching fleet vehicle counts" },
      { status: 500 }
    );
  }
}
