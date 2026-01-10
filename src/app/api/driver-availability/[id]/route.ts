import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverAvailability } from "@/db/schema";
import { updateDriverAvailabilitySchema } from "@/lib/validations/driver-availability";
import { eq, and } from "drizzle-orm";
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

async function getAvailability(id: string, companyId: string) {
  const [availability] = await db
    .select()
    .from(driverAvailability)
    .where(
      and(
        eq(driverAvailability.id, id),
        eq(driverAvailability.companyId, companyId)
      )
    )
    .limit(1);

  return availability;
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
    const availability = await getAvailability(id, tenantCtx.companyId);

    if (!availability) {
      return NextResponse.json(
        { error: "Driver availability not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error fetching driver availability:", error);
    return NextResponse.json(
      { error: "Error fetching driver availability" },
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
    const existingAvailability = await getAvailability(
      id,
      tenantCtx.companyId
    );

    if (!existingAvailability) {
      return NextResponse.json(
        { error: "Driver availability not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateDriverAvailabilitySchema.parse(body);

    const updateData: any = { ...validatedData };
    updateData.updatedAt = new Date();

    const [updatedAvailability] = await db
      .update(driverAvailability)
      .set(updateData)
      .where(eq(driverAvailability.id, id))
      .returning();

    // Log update
    await logUpdate("driver_availability", id, {
      before: existingAvailability,
      after: updatedAvailability,
    });

    return NextResponse.json(updatedAvailability);
  } catch (error) {
    console.error("Error updating driver availability:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating driver availability" },
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
    const existingAvailability = await getAvailability(
      id,
      tenantCtx.companyId
    );

    if (!existingAvailability) {
      return NextResponse.json(
        { error: "Driver availability not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting active to false
    const [deletedAvailability] = await db
      .update(driverAvailability)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(driverAvailability.id, id))
      .returning();

    // Log deletion
    await logDelete("driver_availability", id, existingAvailability);

    return NextResponse.json(deletedAvailability);
  } catch (error) {
    console.error("Error deleting driver availability:", error);
    return NextResponse.json(
      { error: "Error deleting driver availability" },
      { status: 500 }
    );
  }
}
