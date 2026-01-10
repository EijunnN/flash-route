import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverSkills, vehicleSkills, drivers } from "@/db/schema";
import { driverSkillSchema, driverSkillQuerySchema, isExpiringSoon, isExpired } from "@/lib/validations/driver-skill";
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

function getExpiryStatusFilter(status: string) {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  switch (status) {
    case "valid":
      // No expiry date OR expiry is more than 30 days from now
      return sql`${driverSkills.expiresAt} IS NULL OR ${driverSkills.expiresAt} > ${thirtyDaysFromNow}`;
    case "expiring_soon":
      // Expiry is within 30 days from now
      return sql`${driverSkills.expiresAt} >= ${today} AND ${driverSkills.expiresAt} <= ${thirtyDaysFromNow}`;
    case "expired":
      // Expiry is in the past
      return sql`${driverSkills.expiresAt} IS NOT NULL AND ${driverSkills.expiresAt} < ${today}`;
    default:
      return undefined;
  }
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
    const query = driverSkillQuerySchema.parse(Object.fromEntries(searchParams));

    const conditions = [];

    if (query.driverId) {
      conditions.push(eq(driverSkills.driverId, query.driverId));
    }
    if (query.skillId) {
      conditions.push(eq(driverSkills.skillId, query.skillId));
    }
    if (query.status) {
      const expiryFilter = getExpiryStatusFilter(query.status);
      if (expiryFilter) {
        conditions.push(expiryFilter);
      }
    }
    if (query.active !== undefined) {
      conditions.push(eq(driverSkills.active, query.active));
    }

    // Apply tenant filtering
    const whereClause = withTenantFilter(driverSkills, conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select({
          id: driverSkills.id,
          driverId: driverSkills.driverId,
          skillId: driverSkills.skillId,
          obtainedAt: driverSkills.obtainedAt,
          expiresAt: driverSkills.expiresAt,
          active: driverSkills.active,
          createdAt: driverSkills.createdAt,
          updatedAt: driverSkills.updatedAt,
          skill: {
            id: vehicleSkills.id,
            code: vehicleSkills.code,
            name: vehicleSkills.name,
            category: vehicleSkills.category,
            description: vehicleSkills.description,
          },
          driver: {
            id: drivers.id,
            name: drivers.name,
            identification: drivers.identification,
          },
        })
        .from(driverSkills)
        .leftJoin(vehicleSkills, eq(driverSkills.skillId, vehicleSkills.id))
        .leftJoin(drivers, eq(driverSkills.driverId, drivers.id))
        .where(whereClause)
        .orderBy(desc(driverSkills.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: driverSkills.id }).from(driverSkills).where(whereClause),
    ]);

    // Add computed expiry status to each record
    const enrichedData = data.map((item) => {
      const status = item.expiresAt
        ? isExpired(item.expiresAt.toISOString())
          ? "expired"
          : isExpiringSoon(item.expiresAt.toISOString())
          ? "expiring_soon"
          : "valid"
        : "valid";

      return {
        ...item,
        skill: {
          ...item.skill,
          id: item.skill?.id || "",
          code: item.skill?.code || "",
          name: item.skill?.name || "",
          category: item.skill?.category || "EQUIPMENT",
          description: item.skill?.description || "",
        },
        driver: {
          ...item.driver,
          id: item.driver?.id || "",
          name: item.driver?.name || "",
          identification: item.driver?.identification || "",
        },
        expiryStatus: status,
      };
    });

    return NextResponse.json({
      data: enrichedData,
      meta: {
        total: totalResult.length,
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    console.error("Error fetching driver skills:", error);
    return NextResponse.json(
      { error: "Error fetching driver skills" },
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
    const validatedData = driverSkillSchema.parse(body);

    // Verify driver exists and belongs to the same company
    const [driver] = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.id, validatedData.driverId), eq(drivers.companyId, tenantCtx.companyId)))
      .limit(1);

    if (!driver) {
      return NextResponse.json(
        { error: "Conductor no encontrado o no pertenece a la empresa" },
        { status: 400 }
      );
    }

    // Verify skill exists and belongs to the same company
    const [skill] = await db
      .select()
      .from(vehicleSkills)
      .where(and(eq(vehicleSkills.id, validatedData.skillId), eq(vehicleSkills.companyId, tenantCtx.companyId)))
      .limit(1);

    if (!skill) {
      return NextResponse.json(
        { error: "Habilidad no encontrada o no pertenece a la empresa" },
        { status: 400 }
      );
    }

    // Check for duplicate driver-skill combination
    const [existingDriverSkill] = await db
      .select()
      .from(driverSkills)
      .where(
        and(
          eq(driverSkills.companyId, tenantCtx.companyId),
          eq(driverSkills.driverId, validatedData.driverId),
          eq(driverSkills.skillId, validatedData.skillId)
        )
      )
      .limit(1);

    if (existingDriverSkill) {
      return NextResponse.json(
        { error: "El conductor ya tiene asignada esta habilidad" },
        { status: 400 }
      );
    }

    const [newDriverSkill] = await db
      .insert(driverSkills)
      .values({
        ...validatedData,
        companyId: tenantCtx.companyId,
        obtainedAt: validatedData.obtainedAt ? new Date(validatedData.obtainedAt) : new Date(),
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        updatedAt: new Date(),
      })
      .returning();

    // Log creation
    await logCreate("driver_skill", newDriverSkill.id, newDriverSkill);

    return NextResponse.json(newDriverSkill, { status: 201 });
  } catch (error) {
    console.error("Error creating driver skill:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error creating driver skill" },
      { status: 500 }
    );
  }
}
