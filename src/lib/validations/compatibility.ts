import { fleets, vehicles } from "@/db/schema";

// Type inference for Drizzle ORM tables
type FleetRecord = typeof fleets.$inferSelect;
type VehicleRecord = typeof vehicles.$inferSelect;

export interface CompatibilityResult {
  compatible: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validates compatibility between a vehicle and a fleet
 * based on their characteristics
 */
export function validateVehicleFleetCompatibility(
  vehicle: Partial<VehicleRecord>,
  fleet: FleetRecord
): CompatibilityResult {
  const result: CompatibilityResult = {
    compatible: true,
    warnings: [],
    errors: [],
  };

  // Check if vehicle type is compatible with fleet type
  const vehicleTypeCompatibility = checkVehicleTypeCompatibility(
    vehicle.type,
    fleet.type
  );
  if (!vehicleTypeCompatibility.compatible) {
    result.compatible = false;
    if (vehicleTypeCompatibility.reason) {
      result.errors.push(vehicleTypeCompatibility.reason);
    }
  }

  // Check if vehicle capacities are within fleet limits
  const capacityCompatibility = checkCapacityCompatibility(vehicle, fleet);
  if (!capacityCompatibility.compatible) {
    result.compatible = false;
    result.errors.push(...capacityCompatibility.errors);
  }
  result.warnings.push(...capacityCompatibility.warnings);

  // Check special features compatibility
  const featureCompatibility = checkFeatureCompatibility(vehicle, fleet);
  result.warnings.push(...featureCompatibility.warnings);

  return result;
}

/**
 * Checks if vehicle type is compatible with fleet type
 */
function checkVehicleTypeCompatibility(
  vehicleType: string | undefined,
  fleetType: string
): { compatible: boolean; reason?: string } {
  if (!vehicleType) {
    return { compatible: true };
  }

  const compatibilityMap: Record<string, string[]> = {
    HEAVY_LOAD: ["TRUCK", "SEMI_TRUCK", "TRAILER"],
    LIGHT_LOAD: ["VAN", "PICKUP"],
    EXPRESS: ["VAN", "PICKUP", "TRUCK"],
    REFRIGERATED: ["REFRIGERATED_TRUCK", "TRUCK", "VAN"],
    SPECIAL: ["TRUCK", "TRAILER", "SEMI_TRUCK"],
  };

  const allowedVehicles = compatibilityMap[fleetType] || [];

  if (!allowedVehicles.includes(vehicleType)) {
    return {
      compatible: false,
      reason: `Tipo de vehículo ${vehicleType} no es compatible con flota tipo ${fleetType}`,
    };
  }

  return { compatible: true };
}

/**
 * Checks if vehicle capacities are within or match fleet capacities
 */
function checkCapacityCompatibility(
  vehicle: Partial<VehicleRecord>,
  fleet: FleetRecord
): { compatible: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Vehicle should not exceed fleet's max capacity
  if (
    vehicle.weightCapacity !== undefined &&
    vehicle.weightCapacity > fleet.weightCapacity
  ) {
    errors.push(
      `Capacidad de peso del vehículo (${vehicle.weightCapacity}kg) excede la capacidad de la flota (${fleet.weightCapacity}kg)`
    );
  }

  if (
    vehicle.volumeCapacity !== undefined &&
    vehicle.volumeCapacity > fleet.volumeCapacity
  ) {
    errors.push(
      `Capacidad de volumen del vehículo (${vehicle.volumeCapacity}m³) excede la capacidad de la flota (${fleet.volumeCapacity}m³)`
    );
  }

  // Warning if vehicle is significantly underutilized
  if (
    vehicle.weightCapacity !== undefined &&
    vehicle.weightCapacity < fleet.weightCapacity * 0.5
  ) {
    warnings.push(
      `Capacidad de peso del vehículo es significativamente menor que la capacidad de la flota`
    );
  }

  if (
    vehicle.volumeCapacity !== undefined &&
    vehicle.volumeCapacity < fleet.volumeCapacity * 0.5
  ) {
    warnings.push(
      `Capacidad de volumen del vehículo es significativamente menor que la capacidad de la flota`
    );
  }

  return {
    compatible: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Checks if special features align with fleet type
 */
function checkFeatureCompatibility(
  vehicle: Partial<VehicleRecord>,
  fleet: FleetRecord
): { warnings: string[] } {
  const warnings: string[] = [];

  // Refrigerated vehicle should ideally be in REFRIGERATED fleet
  if (vehicle.refrigerated && fleet.type !== "REFRIGERATED") {
    warnings.push(
      "Vehículo refrigerado podría funcionar mejor en una flota tipo REFRIGERATED"
    );
  }

  // Heated vehicle might be better in REFRIGERATED or SPECIAL fleet
  if (vehicle.heated && !["REFRIGERATED", "SPECIAL"].includes(fleet.type)) {
    warnings.push(
      "Vehículo con calefacción podría funcionar mejor en una flota tipo REFRIGERATED o SPECIAL"
    );
  }

  return { warnings };
}

/**
 * Format compatibility result for API response
 */
export function formatCompatibilityResponse(result: CompatibilityResult): {
  compatible: boolean;
  message: string;
  warnings: string[];
  errors: string[];
} {
  let message = "El vehículo es compatible con la flota";

  if (!result.compatible) {
    message = "El vehículo no es compatible con la flota";
  } else if (result.warnings.length > 0) {
    message = "El vehículo es compatible con la flota, pero hay advertencias";
  }

  return {
    compatible: result.compatible,
    message,
    warnings: result.warnings,
    errors: result.errors,
  };
}
