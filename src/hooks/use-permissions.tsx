"use client";

import { useCallback, useEffect, useState } from "react";

interface UserPermissions {
  permissions: string[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and check user permissions
 */
export function usePermissions(): UserPermissions & {
  hasPermission: (entity: string, action: string) => boolean;
  hasAnyPermission: (checks: Array<{ entity: string; action: string }>) => boolean;
  refetch: () => Promise<void>;
} {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        throw new Error("No autorizado");
      }

      const data = await response.json();

      // If user has permissions array from roles
      if (data.permissions) {
        setPermissions(data.permissions);
      } else {
        // Fall back to empty permissions
        setPermissions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar permisos");
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (entity: string, action: string): boolean => {
      // Admin has all permissions
      if (permissions.includes("*")) {
        return true;
      }
      return permissions.includes(`${entity}:${action}`);
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (checks: Array<{ entity: string; action: string }>): boolean => {
      if (permissions.includes("*")) {
        return true;
      }
      return checks.some((check) =>
        permissions.includes(`${check.entity}:${check.action}`),
      );
    },
    [permissions],
  );

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    refetch: fetchPermissions,
  };
}

/**
 * Permission check component - shows children only if user has permission
 */
export function RequirePermission({
  entity,
  action,
  children,
  fallback = null,
}: {
  entity: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!hasPermission(entity, action)) {
    return fallback;
  }

  return <>{children}</>;
}
