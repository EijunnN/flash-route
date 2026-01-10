import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleets, vehicles, drivers } from "@/db/schema";
import { updateFleetSchema } from "@/lib/validations/fleet";
import { eq, and, count } from "drizzle-orm";
import { withTenantFilter, TenantAccessDeniedError } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";
import { logUpdate, logDelete } from "@/lib/audit";

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

    // Apply tenant filtering
    const whereClause = withTenantFilter(fleets, [eq(fleets.id, id)]);

    const [fleet] = await db
      .select()
      .from(fleets)
      .where(whereClause)
      .limit(1);

    if (!fleet) {
      return NextResponse.json(
        { error: "Fleet not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(fleet);
  } catch (error) {
    console.error("Error fetching fleet:", error);
    if (error instanceof TenantAccessDeniedError) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Error fetching fleet" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const body = await request.json();
    const validatedData = updateFleetSchema.parse({ ...body, id });

    // Apply tenant filtering when fetching existing fleet
    const existingWhereClause = withTenantFilter(fleets, [eq(fleets.id, id)]);

    const [existingFleet] = await db
      .select()
      .from(fleets)
      .where(existingWhereClause)
      .limit(1);

    if (!existingFleet) {
      return NextResponse.json(
        { error: "Fleet not found" },
        { status: 404 }
      );
    }

    // Check for duplicate fleet name within the same company (if name is being updated)
    if (validatedData.name && validatedData.name !== existingFleet.name) {
      const duplicateFleet = await db
        .select()
        .from(fleets)
        .where(and(
          eq(fleets.companyId, tenantCtx.companyId),
          eq(fleets.name, validatedData.name),
          eq(fleets.active, true)
        ))
        .limit(1);

      if (duplicateFleet.length > 0) {
        return NextResponse.json(
          { error: "Ya existe una flota activa con este nombre en la empresa" },
          { status: 400 }
        );
      }
    }

    const { id: _, ...updateData } = validatedData;

    const [updatedFleet] = await db
      .update(fleets)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(existingWhereClause)
      .returning();

    // Log update
    await logUpdate("fleet", id, {
      before: existingFleet,
      after: updatedFleet,
    });

    return NextResponse.json(updatedFleet);
  } catch (error) {
    console.error("Error updating fleet:", error);
    if (error instanceof TenantAccessDeniedError) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating fleet" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Apply tenant filtering when fetching existing fleet
    const whereClause = withTenantFilter(fleets, [eq(fleets.id, id)]);

    const [existingFleet] = await db
      .select()
      .from(fleets)
      .where(whereClause)
      .limit(1);

    if (!existingFleet) {
      return NextResponse.json(
        { error: "Fleet not found" },
        { status: 404 }
      );
    }

    // Check if there are active vehicles or drivers in this fleet
    const [activeVehicles] = await db
      .select({ count: count() })
      .from(vehicles)
      .where(and(
        eq(vehicles.fleetId, id),
        eq(vehicles.active, true)
      ));

    const [activeDrivers] = await db
      .select({ count: count() })
      .from(drivers)
      .where(and(
        eq(drivers.fleetId, id),
        eq(drivers.active, true)
      ));

    if (activeVehicles.count > 0 || activeDrivers.count > 0) {
      return NextResponse.json(
        {
          error: "No se puede desactivar la flota",
          details: activeVehicles.count > 0
            ? `Hay ${activeVehicles.count} vehículo(s) activo(s) en esta flota`
            : `Hay ${activeDrivers.count} conductor(es) activo(s) en esta flota`,
        },
        { status: 400 }
      );
    }

    // Soft delete - set active to false
    await db
      .update(fleets)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(whereClause);

    // Log deletion
    await logDelete("fleet", id, existingFleet);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fleet:", error);
    if (error instanceof TenantAccessDeniedError) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Error deleting fleet" },
      { status: 500 }
    );
  }
}
