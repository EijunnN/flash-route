import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { setTenantContext } from "./lib/tenant";
import { verifyToken, extractTokenFromAuthHeader } from "./lib/auth";
import { AUTH_ERRORS } from "./lib/validations/auth";

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/health",
  "/api/docs",
];

/**
 * Routes that only check authentication but don't enforce it (optional auth)
 */
const OPTIONAL_AUTH_ROUTES = [
  "/api/monitoring/summary",
  "/api/monitoring/geojson",
];

/**
 * Check if a route is public
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a route has optional authentication
 */
function isOptionalAuthRoute(pathname: string): boolean {
  return OPTIONAL_AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for public routes
  const isPublic = isPublicRoute(pathname);
  const isOptionalAuth = isOptionalAuthRoute(pathname);

  // Extract and verify JWT token (skip for public routes)
  let payload = null;
  const authHeader = request.headers.get("authorization");

  if (!isPublic && authHeader) {
    const token = extractTokenFromAuthHeader(authHeader);
    if (token) {
      payload = await verifyToken(token);
    }
  }

  // For protected routes, require authentication
  if (!isPublic && !isOptionalAuth && !payload) {
    return NextResponse.json(
      { error: AUTH_ERRORS.UNAUTHORIZED },
      { status: 401 }
    );
  }

  // Set tenant context from JWT or headers
  let companyId = request.headers.get("x-company-id");
  let userId = request.headers.get("x-user-id");

  // If JWT payload exists, use it for context
  if (payload && payload.type === "access") {
    companyId = payload.companyId;
    userId = payload.userId;
  }

  if (companyId) {
    setTenantContext({
      companyId,
      userId: userId || undefined,
    });
  }

  // Create response and add user context headers
  const response = NextResponse.next();

  if (payload && payload.type === "access") {
    response.headers.set("x-user-id", payload.userId);
    response.headers.set("x-user-email", payload.email);
    response.headers.set("x-user-role", payload.role);
    response.headers.set("x-company-id", payload.companyId);
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
