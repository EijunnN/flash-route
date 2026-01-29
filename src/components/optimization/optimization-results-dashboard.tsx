"use client";

import {
  OptimizationDashboardProvider,
  type OptimizationResult,
} from "./optimization-dashboard-context";
import {
  ConfirmationDialog,
  DashboardHeader,
  DashboardMapPanel,
  DashboardMobileKpiStrip,
  DashboardRoutesPanel,
  ReassignmentDialog,
} from "./optimization-dashboard-sections";

// Re-export types for convenience
export type { OptimizationResult };

interface OptimizationResultsDashboardProps {
  jobId?: string;
  result: OptimizationResult;
  isPartial?: boolean;
  jobStatus?: string;
  onReoptimize?: () => void;
  onConfirm?: () => void;
  onBack?: () => void;
  onResultUpdate?: (newResult: OptimizationResult) => void;
}

function OptimizationResultsDashboardContent() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <DashboardHeader />

      {/* Mobile KPI Strip */}
      <DashboardMobileKpiStrip />

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Routes Panel */}
        <DashboardRoutesPanel />

        {/* Map Panel */}
        <DashboardMapPanel />
      </div>

      {/* Dialogs */}
      <ReassignmentDialog />
      <ConfirmationDialog />
    </div>
  );
}

/**
 * OptimizationResultsDashboard - Compound Component Pattern
 *
 * Can be used in two ways:
 *
 * 1. Simple usage (default layout):
 * ```tsx
 * <OptimizationResultsDashboard result={result} jobId={jobId} />
 * ```
 *
 * 2. Compound usage (custom layout):
 * ```tsx
 * <OptimizationResultsDashboard.Provider result={result} jobId={jobId}>
 *   <OptimizationResultsDashboard.Header />
 *   <OptimizationResultsDashboard.MobileKpiStrip />
 *   <div className="flex-1 flex">
 *     <OptimizationResultsDashboard.RoutesPanel />
 *     <OptimizationResultsDashboard.MapPanel />
 *   </div>
 *   <OptimizationResultsDashboard.ReassignmentDialog />
 *   <OptimizationResultsDashboard.ConfirmationDialog />
 * </OptimizationResultsDashboard.Provider>
 * ```
 */
export function OptimizationResultsDashboard({
  jobId,
  result,
  isPartial,
  jobStatus,
  onReoptimize,
  onConfirm,
  onBack,
  onResultUpdate,
}: OptimizationResultsDashboardProps) {
  return (
    <OptimizationDashboardProvider
      jobId={jobId}
      result={result}
      isPartial={isPartial}
      jobStatus={jobStatus}
      onReoptimize={onReoptimize}
      onConfirm={onConfirm}
      onBack={onBack}
      onResultUpdate={onResultUpdate}
    >
      <OptimizationResultsDashboardContent />
    </OptimizationDashboardProvider>
  );
}

// Compound component exports
OptimizationResultsDashboard.Provider = OptimizationDashboardProvider;
OptimizationResultsDashboard.Header = DashboardHeader;
OptimizationResultsDashboard.MobileKpiStrip = DashboardMobileKpiStrip;
OptimizationResultsDashboard.RoutesPanel = DashboardRoutesPanel;
OptimizationResultsDashboard.MapPanel = DashboardMapPanel;
OptimizationResultsDashboard.ReassignmentDialog = ReassignmentDialog;
OptimizationResultsDashboard.ConfirmationDialog = ConfirmationDialog;

// Hook export for custom implementations
export { useOptimizationDashboard } from "./optimization-dashboard-context";
