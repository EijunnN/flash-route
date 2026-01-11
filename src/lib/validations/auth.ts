import { z } from "zod";

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Login response schema
 */
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.string(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(), // seconds until access token expires
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * Refresh token request schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/**
 * Auth error types
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: "Credenciales inválidas",
  USER_NOT_FOUND: "Usuario no encontrado",
  USER_INACTIVE: "Usuario inactivo",
  INVALID_TOKEN: "Token inválido",
  TOKEN_EXPIRED: "Token expirado",
  UNAUTHORIZED: "No autorizado",
  RATE_LIMITED: "Demasiados intentos. Intente nuevamente más tarde",
} as const;
