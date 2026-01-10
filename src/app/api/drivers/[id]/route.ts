import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { drivers } from "@/db/schema";
import { updateDriverSchema, isExpired } from "@/lib/validations/driver";
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

async function getDriver(id: string, companyId: string) {
  const [driver] = await db
    .select()
    .from(drivers)
    .where(
      and(
        eq(drivers.id, id),
        eq(drivers.companyId, companyId)
      )
    )
    .limit(1);

  return driver;
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
    const driver = await getDriver(id, tenantCtx.companyId);

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      );
    }

    // Add computed license status field
    const driverWithStatus = {
      ...driver,
      licenseStatus: isExpired(driver.licenseExpiry.toISOString())
        ? "expired"
        : new Date(driver.licenseExpiry).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
        ? "expiring_soon"
        : "valid",
    };

    return NextResponse.json(driverWithStatus);
  } catch (error) {
    console.error("Error fetching driver:", error);
    return NextResponse.json(
      { error: "Error fetching driver" },
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
    const existingDriver = await getDriver(id, tenantCtx.companyId);

    if (!existingDriver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateDriverSchema.parse(body);

    // Check for duplicate identification if identification is being updated
    if (validatedData.identification && validatedData.identification !== existingDriver.identification) {
      const duplicateDriver = await db
        .select()
        .from(drivers)
        .where(
          and(
            eq(drivers.companyId, tenantCtx.companyId),
            eq(drivers.identification, validatedData.identification),
            or(
              eq(drivers.active, true),
              eq(drivers.active, false)
            )
          )
        )
        .limit(1);

      if (duplicateDriver.length > 0) {
        return NextResponse.json(
          { error: "Ya existe un conductor con esta identificación en la empresa" },
          { status: 400 }
        );
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.birthDate !== undefined) {
      updateData.birthDate = validatedData.birthDate ? new Date(validatedData.birthDate) : null;
    }
    if (validatedData.licenseExpiry !== undefined) {
      updateData.licenseExpiry = new Date(validatedData.licenseExpiry);
      // Auto-set status to UNAVAILABLE if license is expired
      if (isExpired(validatedData.licenseExpiry)) {
        updateData.status = "UNAVAILABLE";
      }
    }
    updateData.updatedAt = new Date();

    const [updatedDriver] = await db
      .update(drivers)
      .set(updateData)
      .where(eq(drivers.id, id))
      .returning();

    // Log update
    await logUpdate("driver", id, {
      before: existingDriver,
      after: updatedDriver,
    });

    return NextResponse.json(updatedDriver);
  } catch (error) {
    console.error("Error updating driver:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating driver" },
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
    const existingDriver = await getDriver(id, tenantCtx.companyId);

    if (!existingDriver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting active to false
    const [deletedDriver] = await db
      .update(drivers)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, id))
      .returning();

    // Log deletion
    await logDelete("driver", id, existingDriver);

    return NextResponse.json(deletedDriver);
  } catch (error) {
    console.error("Error deleting driver:", error);
    return NextResponse.json(
      { error: "Error deleting driver" },
      { status: 500 }
    );
  }
}
