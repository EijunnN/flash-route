import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverSecondaryFleets } from "@/db/schema";
import { updateDriverSecondaryFleetSchema } from "@/lib/validations/driver-secondary-fleet";
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

async function getSecondaryFleet(id: string, companyId: string) {
  const [secondaryFleet] = await db
    .select()
    .from(driverSecondaryFleets)
    .where(
      and(
        eq(driverSecondaryFleets.id, id),
        eq(driverSecondaryFleets.companyId, companyId)
      )
    )
    .limit(1);

  return secondaryFleet;
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
    const secondaryFleet = await getSecondaryFleet(id, tenantCtx.companyId);

    if (!secondaryFleet) {
      return NextResponse.json(
        { error: "Driver secondary fleet not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(secondaryFleet);
  } catch (error) {
    console.error("Error fetching driver secondary fleet:", error);
    return NextResponse.json(
      { error: "Error fetching driver secondary fleet" },
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
    const existingSecondaryFleet = await getSecondaryFleet(
      id,
      tenantCtx.companyId
    );

    if (!existingSecondaryFleet) {
      return NextResponse.json(
        { error: "Driver secondary fleet not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateDriverSecondaryFleetSchema.parse(body);

    const updateData: any = { ...validatedData };
    updateData.updatedAt = new Date();

    const [updatedSecondaryFleet] = await db
      .update(driverSecondaryFleets)
      .set(updateData)
      .where(eq(driverSecondaryFleets.id, id))
      .returning();

    // Log update
    await logUpdate("driver_secondary_fleet", id, {
      before: existingSecondaryFleet,
      after: updatedSecondaryFleet,
    });

    return NextResponse.json(updatedSecondaryFleet);
  } catch (error) {
    console.error("Error updating driver secondary fleet:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating driver secondary fleet" },
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
    const existingSecondaryFleet = await getSecondaryFleet(
      id,
      tenantCtx.companyId
    );

    if (!existingSecondaryFleet) {
      return NextResponse.json(
        { error: "Driver secondary fleet not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting active to false
    const [deletedSecondaryFleet] = await db
      .update(driverSecondaryFleets)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(driverSecondaryFleets.id, id))
      .returning();

    // Log deletion
    await logDelete("driver_secondary_fleet", id, existingSecondaryFleet);

    return NextResponse.json(deletedSecondaryFleet);
  } catch (error) {
    console.error("Error deleting driver secondary fleet:", error);
    return NextResponse.json(
      { error: "Error deleting driver secondary fleet" },
      { status: 500 }
    );
  }
}
