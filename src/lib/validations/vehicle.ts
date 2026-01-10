import { z } from "zod";

export const VEHICLE_STATUS = ["AVAILABLE", "IN_MAINTENANCE", "ASSIGNED", "INACTIVE"] as const;
export const VEHICLE_TYPES = ["TRUCK", "VAN", "SEMI_TRUCK", "PICKUP", "TRAILER", "REFRIGERATED_TRUCK"] as const;
export const LICENSE_CATEGORIES = ["B", "C", "C1", "CE", "D", "D1", "DE"] as const;

// Base vehicle fields
const baseVehicleSchema = {
  fleetId: z.string().uuid("ID de flota inválido"),
  plate: z.string().min(1, "Matrícula es requerida").max(50, "Matrícula demasiado larga"),
  brand: z.string().min(1, "Marca es requerida").max(100, "Marca demasiado larga"),
  model: z.string().min(1, "Modelo es requerido").max(100, "Modelo demasiado largo"),
  year: z.number().int("Año debe ser un entero").min(1900, "Año debe ser al menos 1900").max(new Date().getFullYear() + 1, "Año inválido"),
  type: z.enum(VEHICLE_TYPES, {
    message: "Tipo debe ser TRUCK, VAN, SEMI_TRUCK, PICKUP, TRAILER o REFRIGERATED_TRUCK",
  }),
  weightCapacity: z.number().positive("Capacidad de peso debe ser mayor a 0"),
  volumeCapacity: z.number().positive("Capacidad de volumen debe ser mayor a 0"),
  refrigerated: z.boolean().default(false),
  heated: z.boolean().default(false),
  lifting: z.boolean().default(false),
  licenseRequired: z.enum(LICENSE_CATEGORIES, {
    message: "Categoría de licencia inválida",
  }).optional(),
  insuranceExpiry: z.string().datetime("Fecha de vencimiento de seguro inválida").optional().nullable(),
  inspectionExpiry: z.string().datetime("Fecha de vencimiento de inspección inválida").optional().nullable(),
  status: z.enum(VEHICLE_STATUS, {
    message: "Estado debe ser AVAILABLE, IN_MAINTENANCE, ASSIGNED o INACTIVE",
  }).default("AVAILABLE"),
  active: z.boolean().default(true),
};

export const vehicleSchema = z.object({
  ...baseVehicleSchema,
}).refine(
  (data) => {
    // If refrigerated is true, either licenseRequired should be set or it's ok
    // No specific constraint for now
    return true;
  },
  { message: "Validación de vehículo falló" }
);

export const updateVehicleSchema = z.object({
  id: z.string().uuid(),
  fleetId: z.string().uuid().optional(),
  plate: z.string().min(1).max(50).optional(),
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  weightCapacity: z.number().positive().optional(),
  volumeCapacity: z.number().positive().optional(),
  refrigerated: z.boolean().optional(),
  heated: z.boolean().optional(),
  lifting: z.boolean().optional(),
  licenseRequired: z.enum(LICENSE_CATEGORIES).optional(),
  insuranceExpiry: z.string().datetime().optional().nullable(),
  inspectionExpiry: z.string().datetime().optional().nullable(),
  status: z.enum(VEHICLE_STATUS).optional(),
  active: z.boolean().optional(),
});

export const vehicleQuerySchema = z.object({
  fleetId: z.string().uuid().optional(),
  status: z.enum(VEHICLE_STATUS).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type VehicleQuery = z.infer<typeof vehicleQuerySchema>;
