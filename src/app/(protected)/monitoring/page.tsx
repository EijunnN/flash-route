"use client";

import { ProtectedPage } from "@/components/auth/protected-page";
import { MonitoringProvider, MonitoringDashboardView } from "@/components/monitoring";

export default function MonitoringPage() {
  return (
    <ProtectedPage requiredPermission="monitoring:VIEW">
      <MonitoringProvider>
        <MonitoringDashboardView />
      </MonitoringProvider>
    </ProtectedPage>
  );
}
