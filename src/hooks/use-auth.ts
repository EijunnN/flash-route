"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface User {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

interface UseAuthReturn {
  user: User | null;
  companyId: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Refresh token before it expires (refresh when 2 minutes left)
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;
// Token lifetime from server (15 minutes)
const TOKEN_LIFETIME_MS = 15 * 60 * 1000;

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshRef = useRef<number>(0);

  // Clear refresh timer
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Refresh the access token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent refresh attempts
    if (isRefreshingRef.current) {
      return false;
    }

    // Don't refresh if we just did it recently (within 30 seconds)
    const now = Date.now();
    if (now - lastRefreshRef.current < 30000) {
      return true;
    }

    isRefreshingRef.current = true;

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        lastRefreshRef.current = Date.now();
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // Schedule next token refresh
  const scheduleRefresh = useCallback(() => {
    clearRefreshTimer();

    // Schedule refresh 2 minutes before token expires
    const refreshIn = TOKEN_LIFETIME_MS - TOKEN_REFRESH_MARGIN_MS;

    refreshTimerRef.current = setTimeout(async () => {
      const success = await refreshToken();
      if (success) {
        // Schedule next refresh
        scheduleRefresh();
      } else {
        // Refresh failed, redirect to login
        window.location.href = "/login";
      }
    }, refreshIn);
  }, [clearRefreshTimer, refreshToken]);

  // Fetch current user
  const fetchUser = useCallback(async (attemptRefresh = true) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired, try to refresh
          if (attemptRefresh) {
            const refreshed = await refreshToken();
            if (refreshed) {
              // Retry fetching user after refresh (without attempting refresh again)
              return fetchUser(false);
            }
          }

          // Refresh failed or not attempted - redirect to login
          clearRefreshTimer();
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to fetch user");
      }

      const data = await response.json();
      setUser(data);

      // Schedule proactive token refresh
      scheduleRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching user");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken, scheduleRefresh, clearRefreshTimer]);

  // Initial fetch and cleanup
  useEffect(() => {
    fetchUser();

    // Cleanup timer on unmount
    return () => {
      clearRefreshTimer();
    };
  }, [fetchUser, clearRefreshTimer]);

  // Handle visibility change - refresh token when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && user) {
        // Tab became visible, check if we need to refresh
        const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
        if (timeSinceLastRefresh > TOKEN_LIFETIME_MS - TOKEN_REFRESH_MARGIN_MS) {
          const success = await refreshToken();
          if (success) {
            scheduleRefresh();
          } else {
            window.location.href = "/login";
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, refreshToken, scheduleRefresh]);

  return {
    user,
    companyId: user?.companyId ?? null,
    isLoading,
    error,
    refetch: () => fetchUser(true),
  };
}
