import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, routeStops, optimizationJobs } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { setTenantContext } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import {
  executeReassignmentSchema,
  type ExecuteReassignmentSchema,
} from "@/lib/validations/reassignment";
import {
  getAffectedRoutesForAbsentDriver,
  calculateReassignmentImpact,
} from "@/lib/reassignment";

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

    // Validate request body
    const validationResult = executeReassignmentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data: ExecuteReassignmentSchema = validationResult.data;

    // Validate company ID matches
    if (data.companyId !== tenantCtx.companyId) {
      return NextResponse.json(
        { error: "Company ID mismatch" },
        { status: 403 }
      );
    }

    // Validate absent driver exists and belongs to company
    const absentDriver = await db.query.drivers.findFirst({
      where: and(
        eq(drivers.id, data.absentDriverId),
        eq(drivers.companyId, tenantCtx.companyId)
      ),
    });

    if (!absentDriver) {
      return NextResponse.json(
        { error: "Absent driver not found" },
        { status: 404 }
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let totalReassignedStops = 0;
    let totalReassignedRoutes = 0;

    // Process each reassignment
    for (const reassignment of data.reassignments) {
      // Validate replacement driver
      const replacementDriver = await db.query.drivers.findFirst({
        where: and(
          eq(drivers.id, reassignment.toDriverId),
          eq(drivers.companyId, tenantCtx.companyId)
        ),
      });

      if (!replacementDriver) {
        errors.push(`Replacement driver ${reassignment.toDriverId} not found`);
        continue;
      }

      // Validate the driver is available
      if (replacementDriver.status === "UNAVAILABLE" || replacementDriver.status === "ABSENT") {
        errors.push(`Replacement driver ${replacementDriver.name} is not available`);
        continue;
      }

      // Calculate impact before executing
      const impact = await calculateReassignmentImpact(
        tenantCtx.companyId,
        data.absentDriverId,
        reassignment.toDriverId,
        data.jobId
      );

      if (!impact.isValid) {
        errors.push(
          `Invalid reassignment to ${replacementDriver.name}: ${impact.errors.join(", ")}`
        );
        continue;
      }

      if (impact.warnings.length > 0) {
        warnings.push(
          `Reassigning to ${replacementDriver.name}: ${impact.warnings.join(", ")}`
        );
      }

      // Update all stops for this route
      const updateResult = await db.update(routeStops)
        .set({
          driverId: reassignment.toDriverId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(routeStops.companyId, tenantCtx.companyId),
          eq(routeStops.routeId, reassignment.routeId),
          eq(routeStops.vehicleId, reassignment.vehicleId),
          eq(routeStops.driverId, data.absentDriverId),
          inArray(routeStops.id, reassignment.stopIds)
        ))
        .returning();

      totalReassignedStops += updateResult.length;
      totalReassignedRoutes++;

      // Update driver status to IN_ROUTE for the replacement driver if stops are in progress
      const hasInProgressStops = await db.query.routeStops.findMany({
        where: and(
          eq(routeStops.companyId, tenantCtx.companyId),
          eq(routeStops.driverId, reassignment.toDriverId),
          eq(routeStops.status, "IN_PROGRESS")
        ),
      });

      if (hasInProgressStops.length > 0 && replacementDriver.status === "AVAILABLE") {
        await db.update(drivers)
          .set({
            status: "IN_ROUTE",
            updatedAt: new Date(),
          })
          .where(eq(drivers.id, reassignment.toDriverId));
      }
    }

    // Update absent driver status to UNAVAILABLE if all stops have been reassigned
    const remainingStops = await db.query.routeStops.findMany({
      where: and(
        eq(routeStops.companyId, tenantCtx.companyId),
        eq(routeStops.driverId, data.absentDriverId),
        sql`(${routeStops.status} = 'PENDING' OR ${routeStops.status} = 'IN_PROGRESS')`
      ),
    });

    if (remainingStops.length === 0 && absentDriver.status === "ABSENT") {
      await db.update(drivers)
        .set({
          status: "UNAVAILABLE",
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, data.absentDriverId));
    }

    // Create audit log entries
    for (const reassignment of data.reassignments) {
      const replacementDriver = await db.query.drivers.findFirst({
        where: eq(drivers.id, reassignment.toDriverId),
      });

      if (replacementDriver) {
        await createAuditLog({
          entityType: "reassignment",
          entityId: reassignment.routeId,
          action: "execute_reassignment",
          changes: JSON.stringify({
            absentDriverId: data.absentDriverId,
            absentDriverName: absentDriver.name,
            replacementDriverId: reassignment.toDriverId,
            replacementDriverName: replacementDriver.name,
            vehicleId: reassignment.vehicleId,
            stopIds: reassignment.stopIds,
            reason: data.reason,
          }),
        });
      }
    }

    const success = errors.length === 0;

    return NextResponse.json({
      data: {
        success,
        reassignedStops: totalReassignedStops,
        reassignedRoutes: totalReassignedRoutes,
        errors,
        warnings,
      },
      meta: {
        absentDriverId: data.absentDriverId,
        absentDriverName: absentDriver.name,
        executedAt: new Date().toISOString(),
        executedBy: data.userId,
      },
    }, { status: success ? 200 : 207 });
  } catch (error) {
    console.error("Error executing reassignment:", error);
    return NextResponse.json(
      {
        error: "Error executing reassignment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
