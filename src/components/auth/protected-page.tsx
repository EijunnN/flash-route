"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProtectedPageProps {
  children: React.ReactNode;
  /** Permiso requerido en formato "entity:action" */
  requiredPermission?: string;
  /** Múltiples permisos - usuario necesita AL MENOS UNO */
  requiredPermissions?: string[];
  /** Página a redirigir si no tiene permiso */
  redirectTo?: string;
  /** Mostrar mensaje de acceso denegado en lugar de redirigir */
  showAccessDenied?: boolean;
}

interface UserData {
  permissions: string[];
  name: string;
  role: string;
}

/**
 * Componente que protege una página completa según permisos
 * Úsalo envolviendo el contenido de tu página:
 *
 * ```tsx
 * export default function RolesPage() {
 *   return (
 *     <ProtectedPage requiredPermission="roles:VIEW">
 *       <div>Contenido de la página...</div>
 *     </ProtectedPage>
 *   );
 * }
 * ```
 */
export function ProtectedPage({
  children,
  requiredPermission,
  requiredPermissions,
  redirectTo = "/dashboard",
  showAccessDenied = true,
}: ProtectedPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
          // No autenticado, redirigir a login
          router.push("/login");
          return;
        }

        const userData: UserData = await response.json();
        setUser(userData);

        const permissions = userData.permissions || [];

        // Admin tiene acceso a todo
        if (permissions.includes("*")) {
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // Verificar permiso único
        if (requiredPermission) {
          const allowed = permissions.includes(requiredPermission);
          setHasAccess(allowed);

          if (!allowed && !showAccessDenied) {
            router.push(redirectTo);
          }
        }
        // Verificar múltiples permisos (necesita al menos uno)
        else if (requiredPermissions && requiredPermissions.length > 0) {
          const allowed = requiredPermissions.some((perm) =>
            permissions.includes(perm)
          );
          setHasAccess(allowed);

          if (!allowed && !showAccessDenied) {
            router.push(redirectTo);
          }
        }
        // Sin requisitos de permiso, acceso permitido
        else {
          setHasAccess(true);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }

    checkPermissions();
  }, [requiredPermission, requiredPermissions, redirectTo, showAccessDenied, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  // Access denied state
  if (!hasAccess && showAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <svg
            className="h-12 w-12 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Acceso Denegado
        </h2>
        <p className="text-muted-foreground max-w-md mb-4">
          No tienes permisos para acceder a esta página.
          {user && (
            <span className="block mt-2 text-sm">
              Tu rol actual: <strong>{user.role}</strong>
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Ir al Dashboard
        </button>
      </div>
    );
  }

  // Has access - render children
  return <>{children}</>;
}

/**
 * Mapeo de rutas a permisos requeridos
 * Usado para proteger automáticamente páginas
 */
export const PAGE_PERMISSIONS: Record<string, string> = {
  "/roles": "roles:VIEW",
  "/users": "users:VIEW",
  "/orders": "orders:VIEW",
  "/vehicles": "vehicles:VIEW",
  "/drivers": "drivers:VIEW",
  "/fleets": "fleets:VIEW",
  "/zones": "zones:VIEW",
  "/alerts": "alerts:VIEW",
  "/optimization-presets": "presets:VIEW",
  "/planificacion": "optimization:VIEW",
  "/monitoring": "routes:VIEW",
};
