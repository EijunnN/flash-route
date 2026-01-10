import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { vehicleSchema, vehicleQuerySchema, VEHICLE_TYPES } from "@/lib/validations/vehicle";
import { eq, and, desc, or } from "drizzle-orm";
import { withTenantFilter } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";
import { logCreate, logUpdate, logDelete } from "@/lib/audit";

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

export async function GET(request: NextRequest) {
  try {
    const tenantCtx = extractTenantContext(request);
    if (!tenantCtx) {
      return NextResponse.json(
        { error: "Missing tenant context" },
        { status: 401 }
      );
    }

    setTenantContext(tenantCtx);

    const { searchParams } = new URL(request.url);
    const query = vehicleQuerySchema.parse(Object.fromEntries(searchParams));

    const conditions = [];

    if (query.fleetId) {
      conditions.push(eq(vehicles.fleetId, query.fleetId));
    }
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
      data,
      meta: {
        total: totalResult.length,
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json(
      { error: "Error fetching vehicles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantCtx = extractTenantContext(request);
    if (!tenantCtx) {
      return NextResponse.json(
        { error: "Missing tenant context" },
        { status: 401 }
      );
    }

    setTenantContext(tenantCtx);

    const body = await request.json();
    const validatedData = vehicleSchema.parse(body);

    // Check for duplicate plate within the same company
    const existingVehicle = await db
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.companyId, tenantCtx.companyId),
          eq(vehicles.plate, validatedData.plate),
          or(
            eq(vehicles.active, true),
            eq(vehicles.active, false)
          )
        )
      )
      .limit(1);

    if (existingVehicle.length > 0) {
      return NextResponse.json(
        { error: "Ya existe un vehículo con esta matrícula en la empresa" },
        { status: 400 }
      );
    }

    const [newVehicle] = await db
      .insert(vehicles)
      .values({
        ...validatedData,
        companyId: tenantCtx.companyId,
        insuranceExpiry: validatedData.insuranceExpiry ? new Date(validatedData.insuranceExpiry) : null,
        inspectionExpiry: validatedData.inspectionExpiry ? new Date(validatedData.inspectionExpiry) : null,
        updatedAt: new Date(),
      })
      .returning();

    // Log creation
    await logCreate("vehicle", newVehicle.id, newVehicle);

    return NextResponse.json(newVehicle, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error creating vehicle" },
      { status: 500 }
    );
  }
}
