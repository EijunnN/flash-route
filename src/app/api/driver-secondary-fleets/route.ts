import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  driverSecondaryFleets,
  drivers,
  fleets,
} from "@/db/schema";
import {
  driverSecondaryFleetSchema,
  driverSecondaryFleetQuerySchema,
} from "@/lib/validations/driver-secondary-fleet";
import { eq, and, desc, sql } from "drizzle-orm";
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
    const query = driverSecondaryFleetQuerySchema.parse(
      Object.fromEntries(searchParams)
    );

    const conditions = [];

    if (query.driverId) {
      conditions.push(eq(driverSecondaryFleets.driverId, query.driverId));
    }
    if (query.fleetId) {
      conditions.push(eq(driverSecondaryFleets.fleetId, query.fleetId));
    }
    if (query.active !== undefined) {
      conditions.push(eq(driverSecondaryFleets.active, query.active));
    }

    const whereClause = withTenantFilter(driverSecondaryFleets, conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(driverSecondaryFleets)
        .where(whereClause)
        .orderBy(desc(driverSecondaryFleets.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db
        .select({ count: driverSecondaryFleets.id })
        .from(driverSecondaryFleets)
        .where(whereClause),
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
    console.error("Error fetching driver secondary fleets:", error);
    return NextResponse.json(
      { error: "Error fetching driver secondary fleets" },
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
    const validatedData = driverSecondaryFleetSchema.parse(body);

    // Verify the driver exists and belongs to the same company
    const [existingDriver] = await db
      .select()
      .from(drivers)
      .where(
        and(
          eq(drivers.id, validatedData.driverId),
          eq(drivers.companyId, tenantCtx.companyId)
        )
      )
      .limit(1);

    if (!existingDriver) {
      return NextResponse.json(
        { error: "Conductor no encontrado o no pertenece a esta empresa" },
        { status: 404 }
      );
    }

    // Verify the fleet exists and belongs to the same company
    const [existingFleet] = await db
      .select()
      .from(fleets)
      .where(
        and(
          eq(fleets.id, validatedData.fleetId),
          eq(fleets.companyId, tenantCtx.companyId)
        )
      )
      .limit(1);

    if (!existingFleet) {
      return NextResponse.json(
        { error: "Flota no encontrada o no pertenece a esta empresa" },
        { status: 404 }
      );
    }

    // Check for duplicate secondary fleet assignment
    const [existingAssignment] = await db
      .select()
      .from(driverSecondaryFleets)
      .where(
        and(
          eq(driverSecondaryFleets.driverId, validatedData.driverId),
          eq(driverSecondaryFleets.fleetId, validatedData.fleetId),
          eq(driverSecondaryFleets.active, true)
        )
      )
      .limit(1);

    if (existingAssignment) {
      return NextResponse.json(
        {
          error:
            "El conductor ya tiene esta flota asignada como secundaria",
        },
        { status: 400 }
      );
    }

    // Check if the driver's primary fleet is the same as the secondary
    if (existingDriver.fleetId === validatedData.fleetId) {
      return NextResponse.json(
        {
          error:
            "La flota secundaria no puede ser la misma que la flota primaria",
        },
        { status: 400 }
      );
    }

    const [newSecondaryFleet] = await db
      .insert(driverSecondaryFleets)
      .values({
        ...validatedData,
        companyId: tenantCtx.companyId,
        updatedAt: new Date(),
      })
      .returning();

    // Log creation
    await logCreate("driver_secondary_fleet", newSecondaryFleet.id, newSecondaryFleet);

    return NextResponse.json(newSecondaryFleet, { status: 201 });
  } catch (error) {
    console.error("Error creating driver secondary fleet:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error creating driver secondary fleet" },
      { status: 500 }
    );
  }
}
