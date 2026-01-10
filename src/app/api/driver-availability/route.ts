import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverAvailability, drivers } from "@/db/schema";
import {
  driverAvailabilitySchema,
  driverAvailabilityQuerySchema,
} from "@/lib/validations/driver-availability";
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
    const query = driverAvailabilityQuerySchema.parse(
      Object.fromEntries(searchParams)
    );

    const conditions = [];

    if (query.driverId) {
      conditions.push(eq(driverAvailability.driverId, query.driverId));
    }
    if (query.dayOfWeek) {
      conditions.push(eq(driverAvailability.dayOfWeek, query.dayOfWeek));
    }
    if (query.isDayOff !== undefined) {
      conditions.push(eq(driverAvailability.isDayOff, query.isDayOff));
    }
    if (query.active !== undefined) {
      conditions.push(eq(driverAvailability.active, query.active));
    }

    const whereClause = withTenantFilter(driverAvailability, conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(driverAvailability)
        .where(whereClause)
        .orderBy(desc(driverAvailability.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db
        .select({ count: driverAvailability.id })
        .from(driverAvailability)
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
    console.error("Error fetching driver availability:", error);
    return NextResponse.json(
      { error: "Error fetching driver availability" },
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
    const validatedData = driverAvailabilitySchema.parse(body);

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

    // Check for duplicate availability for the same driver and day
    const [existingAvailability] = await db
      .select()
      .from(driverAvailability)
      .where(
        and(
          eq(driverAvailability.driverId, validatedData.driverId),
          eq(driverAvailability.dayOfWeek, validatedData.dayOfWeek),
          eq(driverAvailability.active, true)
        )
      )
      .limit(1);

    if (existingAvailability) {
      return NextResponse.json(
        {
          error:
            "Ya existe una configuración de disponibilidad para este conductor y día",
        },
        { status: 400 }
      );
    }

    const [newAvailability] = await db
      .insert(driverAvailability)
      .values({
        ...validatedData,
        companyId: tenantCtx.companyId,
        updatedAt: new Date(),
      })
      .returning();

    // Log creation
    await logCreate("driver_availability", newAvailability.id, newAvailability);

    return NextResponse.json(newAvailability, { status: 201 });
  } catch (error) {
    console.error("Error creating driver availability:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error creating driver availability" },
      { status: 500 }
    );
  }
}
