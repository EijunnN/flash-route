import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleets, vehicles } from "@/db/schema";
import { vehicleQuerySchema, VEHICLE_STATUS } from "@/lib/validations/vehicle";
import { eq, and, desc } from "drizzle-orm";
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

    const { searchParams } = new URL(request.url);
    const query = vehicleQuerySchema.parse({
      ...Object.fromEntries(searchParams),
      fleetId: id, // Override fleetId with the route param
    });

    const conditions = [eq(vehicles.fleetId, id)];

    if (query.status) {
      conditions.push(eq(vehicles.status, query.status));
    }
    if (query.type) {
      conditions.push(eq(vehicles.type, query.type));
    }
    if (query.active !== undefined) {
      conditions.push(eq(vehicles.active, query.active));
    }

    // Apply tenant filtering
    const whereClause = withTenantFilter(vehicles, conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(vehicles)
        .where(whereClause)
        .orderBy(desc(vehicles.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: vehicles.id }).from(vehicles).where(whereClause),
    ]);

    return NextResponse.json({
      fleet: {
        id: fleet.id,
        name: fleet.name,
        type: fleet.type,
      },
      data,
      meta: {
        total: totalResult.length,
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    console.error("Error fetching fleet vehicles:", error);
    if (error instanceof TenantAccessDeniedError) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Error fetching fleet vehicles" },
      { status: 500 }
    );
  }
}
