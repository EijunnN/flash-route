import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { updateVehicleSchema } from "@/lib/validations/vehicle";
import { eq, and, or } from "drizzle-orm";
import { withTenantFilter, verifyTenantAccess } from "@/db/tenant-aware";
import { setTenantContext, getTenantContext } from "@/lib/tenant";
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

async function getVehicle(id: string, companyId: string) {
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.companyId, companyId)
      )
    )
    .limit(1);

  return vehicle;
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
    const vehicle = await getVehicle(id, tenantCtx.companyId);

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return NextResponse.json(
      { error: "Error fetching vehicle" },
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
    const existingVehicle = await getVehicle(id, tenantCtx.companyId);

    if (!existingVehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateVehicleSchema.parse(body);

    // Check for duplicate plate if plate is being updated
    if (validatedData.plate && validatedData.plate !== existingVehicle.plate) {
      const duplicateVehicle = await db
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

      if (duplicateVehicle.length > 0) {
        return NextResponse.json(
          { error: "Ya existe un vehículo con esta matrícula en la empresa" },
          { status: 400 }
        );
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.insuranceExpiry !== undefined) {
      updateData.insuranceExpiry = validatedData.insuranceExpiry ? new Date(validatedData.insuranceExpiry) : null;
    }
    if (validatedData.inspectionExpiry !== undefined) {
      updateData.inspectionExpiry = validatedData.inspectionExpiry ? new Date(validatedData.inspectionExpiry) : null;
    }
    updateData.updatedAt = new Date();

    const [updatedVehicle] = await db
      .update(vehicles)
      .set(updateData)
      .where(eq(vehicles.id, id))
      .returning();

    // Log update
    await logUpdate("vehicle", id, {
      before: existingVehicle,
      after: updatedVehicle,
    });

    return NextResponse.json(updatedVehicle);
  } catch (error) {
    console.error("Error updating vehicle:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating vehicle" },
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
    const existingVehicle = await getVehicle(id, tenantCtx.companyId);

    if (!existingVehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting active to false
    const [deletedVehicle] = await db
      .update(vehicles)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(vehicles.id, id))
      .returning();

    // Log deletion
    await logDelete("vehicle", id, existingVehicle);

    return NextResponse.json(deletedVehicle);
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    return NextResponse.json(
      { error: "Error deleting vehicle" },
      { status: 500 }
    );
  }
}
