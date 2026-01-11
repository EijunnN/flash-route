import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// JWT Configuration
const ACCESS_TOKEN_EXPIRY = "15min"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

// Cookie names
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

// Secret key - should be stored in environment variables
const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
};

// Token payload interface
export interface TokenPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
  type: "access" | "refresh";
}

/**
 * Generate an access token (short-lived)
 */
export async function generateAccessToken(payload: Omit<TokenPayload, "type">): Promise<string> {
  const secret = getSecretKey();

  return await new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setSubject(payload.userId)
    .sign(secret);
}

/**
 * Generate a refresh token (long-lived)
 */
export async function generateRefreshToken(payload: Omit<TokenPayload, "type">): Promise<string> {
  const secret = getSecretKey();

  return await new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setSubject(payload.userId)
    .sign(secret);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Set authentication cookies
 */
export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

/**
 * Clear authentication cookies
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

/**
 * Get access token from cookies
 */
export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

/**
 * Get refresh token from cookies
 */
export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Get current user from request cookies
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAccessToken();
  if (!token) return null;

  return await verifyToken(token);
}

/**
 * Generate token pair for authentication response
 */
export async function generateTokenPair(user: {
  id: string;
  companyId: string;
  email: string;
  role: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = {
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
    role: user.role,
  };

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);

  return { accessToken, refreshToken };
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}
