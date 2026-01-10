import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleets } from "@/db/schema";
import { fleetSchema, fleetQuerySchema, FLEET_TYPES } from "@/lib/validations/fleet";
import { eq, and, desc } from "drizzle-orm";
import { withTenantFilter } from "@/db/tenant-aware";
import { setTenantContext } from "@/lib/tenant";
import { logCreate } from "@/lib/audit";

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
    const query = fleetQuerySchema.parse(Object.fromEntries(searchParams));

    const conditions = [];

    if (query.active !== undefined) {
      conditions.push(eq(fleets.active, query.active));
    }
    if (query.type) {
      conditions.push(eq(fleets.type, query.type));
    }

    // Apply tenant filtering
    const whereClause = withTenantFilter(fleets, conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(fleets)
        .where(whereClause)
        .orderBy(desc(fleets.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: fleets.id }).from(fleets).where(whereClause),
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
    console.error("Error fetching fleets:", error);
    return NextResponse.json(
      { error: "Error fetching fleets" },
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
    const validatedData = fleetSchema.parse(body);

    // Check for duplicate fleet name within the same company
    const existingFleet = await db
      .select()
      .from(fleets)
      .where(
        and(
          eq(fleets.companyId, tenantCtx.companyId),
          eq(fleets.name, validatedData.name),
          eq(fleets.active, true)
        )
      )
      .limit(1);

    if (existingFleet.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una flota activa con este nombre en la empresa" },
        { status: 400 }
      );
    }

    const [newFleet] = await db
      .insert(fleets)
      .values({
        ...validatedData,
        companyId: tenantCtx.companyId,
        updatedAt: new Date(),
      })
      .returning();

    // Log creation
    await logCreate("fleet", newFleet.id, newFleet);

    return NextResponse.json(newFleet, { status: 201 });
  } catch (error) {
    console.error("Error creating fleet:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error creating fleet" },
      { status: 500 }
    );
  }
}
