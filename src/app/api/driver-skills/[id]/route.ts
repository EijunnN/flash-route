import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverSkills, vehicleSkills, drivers } from "@/db/schema";
import { updateDriverSkillSchema } from "@/lib/validations/driver-skill";
import { eq, and } from "drizzle-orm";
import { verifyTenantAccess } from "@/db/tenant-aware";
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

async function getDriverSkill(id: string, companyId: string) {
  const [driverSkill] = await db
    .select()
    .from(driverSkills)
    .where(
      and(
        eq(driverSkills.id, id),
        eq(driverSkills.companyId, companyId)
      )
    )
    .limit(1);

  return driverSkill;
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
    const driverSkill = await getDriverSkill(id, tenantCtx.companyId);

    if (!driverSkill) {
      return NextResponse.json(
        { error: "Driver skill not found" },
        { status: 404 }
      );
    }

    // Fetch related skill and driver data
    const [skill, driver] = await Promise.all([
      db.select().from(vehicleSkills).where(eq(vehicleSkills.id, driverSkill.skillId)).limit(1),
      db.select().from(drivers).where(eq(drivers.id, driverSkill.driverId)).limit(1),
    ]);

    return NextResponse.json({
      ...driverSkill,
      skill: skill[0] || null,
      driver: driver[0] || null,
    });
  } catch (error) {
    console.error("Error fetching driver skill:", error);
    return NextResponse.json(
      { error: "Error fetching driver skill" },
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
    const existingDriverSkill = await getDriverSkill(id, tenantCtx.companyId);

    if (!existingDriverSkill) {
      return NextResponse.json(
        { error: "Driver skill not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateDriverSkillSchema.parse(body);

    const updateData: any = { ...validatedData };
    if (validatedData.obtainedAt !== undefined) {
      updateData.obtainedAt = validatedData.obtainedAt ? new Date(validatedData.obtainedAt) : null;
    }
    if (validatedData.expiresAt !== undefined) {
      updateData.expiresAt = validatedData.expiresAt ? new Date(validatedData.expiresAt) : null;
    }
    updateData.updatedAt = new Date();

    const [updatedDriverSkill] = await db
      .update(driverSkills)
      .set(updateData)
      .where(eq(driverSkills.id, id))
      .returning();

    // Log update
    await logUpdate("driver_skill", id, {
      before: existingDriverSkill,
      after: updatedDriverSkill,
    });

    return NextResponse.json(updatedDriverSkill);
  } catch (error) {
    console.error("Error updating driver skill:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating driver skill" },
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
    const existingDriverSkill = await getDriverSkill(id, tenantCtx.companyId);

    if (!existingDriverSkill) {
      return NextResponse.json(
        { error: "Driver skill not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting active to false
    const [deletedDriverSkill] = await db
      .update(driverSkills)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(driverSkills.id, id))
      .returning();

    // Log deletion
    await logDelete("driver_skill", id, existingDriverSkill);

    return NextResponse.json(deletedDriverSkill);
  } catch (error) {
    console.error("Error deleting driver skill:", error);
    return NextResponse.json(
      { error: "Error deleting driver skill" },
      { status: 500 }
    );
  }
}
