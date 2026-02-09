"use client";

import { useGlobalCompany } from "@/components/layout/company-context";

/**
 * Hook that provides company context for pages that need tenant filtering.
 * Delegates to the global CompanyProvider in the layout.
 */
export function useCompanyContext() {
  return useGlobalCompany();
}
