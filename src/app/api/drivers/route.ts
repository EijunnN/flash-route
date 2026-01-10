import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { drivers } from "@/db/schema";
import { driverSchema, driverQuerySchema, DRIVER_STATUS, isExpiringSoon, isExpired } from "@/lib/validations/driver";
import { eq, and, desc, or, gte, lte, sql } from "drizzle-orm";
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

function getLicenseStatusFilter(licenseStatus: string) {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  switch (licenseStatus) {
    case "valid":
      // License expiry is more than 30 days from now
      return sql`${drivers.licenseExpiry} > ${thirtyDaysFromNow}`;
    case "expiring_soon":
      // License expiry is within 30 days from now
      return sql`${drivers.licenseExpiry} >= ${today} AND ${drivers.licenseExpiry} <= ${thirtyDaysFromNow}`;
    case "expired":
      // License expiry is in the past
      return sql`${drivers.licenseExpiry} < ${today}`;
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
    const query = driverQuerySchema.parse(Object.fromEntries(searchParams));

    const conditions = [];

    if (query.fleetId) {
      conditions.push(eq(drivers.fleetId, query.fleetId));
    }
    if (query.status) {
      conditions.push(eq(drivers.status, query.status));
    }
    if (query.licenseStatus) {
      const licenseFilter = getLicenseStatusFilter(query.licenseStatus);
      if (licenseFilter) {
        conditions.push(licenseFilter);
      }
    }
    if (query.hasCertifications !== undefined) {
      if (query.hasCertifications) {
        conditions.push(sql`${drivers.certifications} IS NOT NULL AND ${drivers.certifications} != ''`);
      } else {
        conditions.push(sql`${drivers.certifications} IS NULL OR ${drivers.certifications} = ''`);
      }
    }
    if (query.active !== undefined) {
      conditions.push(eq(drivers.active, query.active));
    }

    // Apply tenant filtering
    const whereClause = withTenantFilter(drivers, conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(drivers)
        .where(whereClause)
        .orderBy(desc(drivers.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: drivers.id }).from(drivers).where(whereClause),
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
    console.error("Error fetching drivers:", error);
    return NextResponse.json(
      { error: "Error fetching drivers" },
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
    const validatedData = driverSchema.parse(body);

    // Check for duplicate identification within the same company
    const existingDriver = await db
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

    if (existingDriver.length > 0) {
      return NextResponse.json(
        { error: "Ya existe un conductor con esta identificación en la empresa" },
        { status: 400 }
      );
    }

    // Auto-set status to UNAVAILABLE if license is expired
    let finalStatus = validatedData.status;
    if (isExpired(validatedData.licenseExpiry)) {
      finalStatus = "UNAVAILABLE";
    }

    const [newDriver] = await db
      .insert(drivers)
      .values({
        ...validatedData,
        companyId: tenantCtx.companyId,
        status: finalStatus,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null,
        licenseExpiry: new Date(validatedData.licenseExpiry),
        updatedAt: new Date(),
      })
      .returning();

    // Log creation
    await logCreate("driver", newDriver.id, newDriver);

    return NextResponse.json(newDriver, { status: 201 });
  } catch (error) {
    console.error("Error creating driver:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error creating driver" },
      { status: 500 }
    );
  }
}
