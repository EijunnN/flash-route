import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverAvailability, drivers } from "@/db/schema";
import { availabilityCheckSchema, getDayOfWeek, isTimeInRange } from "@/lib/validations/driver-availability";
import { eq, and, or } from "drizzle-orm";
import { setTenantContext } from "@/lib/tenant";

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
    const validatedData = availabilityCheckSchema.parse(body);

    // Parse the date to get the day of week
    const checkDate = new Date(validatedData.date);
    const dayOfWeek = getDayOfWeek(checkDate);

    // Get the driver's availability for the specific day
    const availabilityRecords = await db
      .select()
      .from(driverAvailability)
      .where(
        and(
          eq(driverAvailability.driverId, validatedData.driverId),
          eq(driverAvailability.companyId, tenantCtx.companyId),
          eq(driverAvailability.dayOfWeek, dayOfWeek),
          eq(driverAvailability.active, true)
        )
      )
      .limit(1);

    // If no availability record found, driver is not available
    if (availabilityRecords.length === 0) {
      return NextResponse.json({
        available: false,
        reason: "No hay configuración de disponibilidad para este día",
      });
    }

    const availability = availabilityRecords[0];

    // If it's a day off, driver is not available
    if (availability.isDayOff) {
      return NextResponse.json({
        available: false,
        reason: "Día de descanso configurado",
        isDayOff: true,
      });
    }

    // Check if the requested time is within the available range
    const isWithinRange = isTimeInRange(
      validatedData.time,
      availability.startTime,
      availability.endTime
    );

    if (!isWithinRange) {
      return NextResponse.json({
        available: false,
        reason: `Fuera del horario disponible (${availability.startTime} - ${availability.endTime})`,
        availableRange: {
          start: availability.startTime,
          end: availability.endTime,
        },
      });
    }

    // Also check if the driver is active and available in general status
    const [driver] = await db
      .select()
      .from(drivers)
      .where(
        and(
          eq(drivers.id, validatedData.driverId),
          eq(drivers.companyId, tenantCtx.companyId)
        )
      )
      .limit(1);

    if (!driver) {
      return NextResponse.json({
        available: false,
        reason: "Conductor no encontrado",
      });
    }

    if (!driver.active) {
      return NextResponse.json({
        available: false,
        reason: "Conductor inactivo",
      });
    }

    // Check if driver's status allows for assignment
    if (driver.status !== "AVAILABLE" && driver.status !== "COMPLETED") {
      return NextResponse.json({
        available: false,
        reason: `Conductor no disponible (estado actual: ${driver.status})`,
        currentStatus: driver.status,
      });
    }

    return NextResponse.json({
      available: true,
      availability: {
        dayOfWeek,
        startTime: availability.startTime,
        endTime: availability.endTime,
      },
    });
  } catch (error) {
    console.error("Error checking driver availability:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error checking driver availability" },
      { status: 500 }
    );
  }
}
