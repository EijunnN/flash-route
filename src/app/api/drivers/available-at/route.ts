import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  drivers,
  driverAvailability,
  driverSecondaryFleets,
} from "@/db/schema";
import { getDayOfWeek, isTimeInRange } from "@/lib/validations/driver-availability";
import { eq, and, or, sql } from "drizzle-orm";
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

// Schema for query parameters
const availableAtQuerySchema = {
  fleetId: "string",
  date: "string",
  time: "string",
};

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

    const fleetId = searchParams.get("fleetId");
    const date = searchParams.get("date");
    const time = searchParams.get("time");

    if (!fleetId || !date || !time) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: fleetId, date, time are required",
        },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
      return NextResponse.json(
        { error: "Time must be in HH:MM format" },
        { status: 400 }
      );
    }

    // Parse the date to get the day of week
    const checkDate = new Date(date);
    const dayOfWeek = getDayOfWeek(checkDate);

    // Get all drivers that belong to the fleet (either primary or secondary)
    const allDrivers = await db
      .select({
        id: drivers.id,
        name: drivers.name,
        fleetId: drivers.fleetId,
        status: drivers.status,
        active: drivers.active,
        identification: drivers.identification,
        email: drivers.email,
        phone: drivers.phone,
        licenseNumber: drivers.licenseNumber,
        licenseExpiry: drivers.licenseExpiry,
        licenseCategories: drivers.licenseCategories,
      })
      .from(drivers)
      .where(
        and(
          eq(drivers.companyId, tenantCtx.companyId),
          eq(drivers.active, true),
          or(
            eq(drivers.fleetId, fleetId),
            sql`${drivers.id} IN (SELECT driver_id FROM driver_secondary_fleets WHERE fleet_id = ${fleetId} AND active = true AND company_id = ${tenantCtx.companyId})`
          )
        )
      );

    const availableDrivers = [];

    for (const driver of allDrivers) {
      // Check if driver's status allows for assignment
      if (driver.status !== "AVAILABLE" && driver.status !== "COMPLETED") {
        continue;
      }

      // Get the driver's availability for the specific day
      const availabilityRecords = await db
        .select()
        .from(driverAvailability)
        .where(
          and(
            eq(driverAvailability.driverId, driver.id),
            eq(driverAvailability.companyId, tenantCtx.companyId),
            eq(driverAvailability.dayOfWeek, dayOfWeek),
            eq(driverAvailability.active, true)
          )
        )
        .limit(1);

      // If no availability record found, skip driver
      if (availabilityRecords.length === 0) {
        continue;
      }

      const availability = availabilityRecords[0];

      // If it's a day off, skip driver
      if (availability.isDayOff) {
        continue;
      }

      // Check if the requested time is within the available range
      const isWithinRange = isTimeInRange(
        time,
        availability.startTime,
        availability.endTime
      );

      if (!isWithinRange) {
        continue;
      }

      // Driver is available
      availableDrivers.push({
        ...driver,
        availability: {
          dayOfWeek,
          startTime: availability.startTime,
          endTime: availability.endTime,
        },
      });
    }

    return NextResponse.json({
      data: availableDrivers,
      meta: {
        total: availableDrivers.length,
        fleetId,
        date,
        time,
        dayOfWeek,
      },
    });
  } catch (error) {
    console.error("Error getting available drivers:", error);
    return NextResponse.json(
      { error: "Error getting available drivers" },
      { status: 500 }
    );
  }
}
