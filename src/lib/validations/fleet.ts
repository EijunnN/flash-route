import { z } from "zod";

export const FLEET_TYPES = ["HEAVY_LOAD", "LIGHT_LOAD", "EXPRESS", "REFRIGERATED", "SPECIAL"] as const;

// Base fleet fields (without refinement for partial usage)
const baseFleetSchema = {
  name: z.string().min(1, "Nombre es requerido").max(255),
  type: z.enum(FLEET_TYPES, {
    message: "Tipo debe ser HEAVY_LOAD, LIGHT_LOAD, EXPRESS, REFRIGERATED o SPECIAL",
  }),
  weightCapacity: z.number().positive("Capacidad de peso debe ser mayor a 0"),
  volumeCapacity: z.number().positive("Capacidad de volumen debe ser mayor a 0"),
  operationStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inicio debe ser HH:MM"),
  operationEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora fin debe ser HH:MM"),
  active: z.boolean().default(true),
};

export const fleetSchema = z.object(baseFleetSchema).refine(
  (data) => {
    const [startHour, startMin] = data.operationStart.split(":").map(Number);
    const [endHour, endMin] = data.operationEnd.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  { message: "Hora fin debe ser posterior a hora inicio", path: ["operationEnd"] }
);

export const updateFleetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  type: z.enum(FLEET_TYPES).optional(),
  weightCapacity: z.number().positive().optional(),
  volumeCapacity: z.number().positive().optional(),
  operationStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  operationEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  active: z.boolean().optional(),
});

export const fleetQuerySchema = z.object({
  type: z.enum(FLEET_TYPES).optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type FleetInput = z.infer<typeof fleetSchema>;
export type UpdateFleetInput = z.infer<typeof updateFleetSchema>;
export type FleetQuery = z.infer<typeof fleetQuerySchema>;
