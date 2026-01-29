"use client";

import { AlertCircle, Bell, Loader2, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { AlertPanel } from "@/components/alerts/alert-panel";
import { CompanySelector } from "@/components/company-selector";
import { DriverListItem } from "./driver-list-item";
import { DriverRouteDetail } from "./driver-route-detail";
import { MonitoringMetrics } from "./monitoring-metrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMonitoring } from "./monitoring-context";

const MonitoringMap = dynamic(() => import("./monitoring-map").then((mod) => mod.MonitoringMap), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export function MonitoringDashboardView() {
  const { state, actions, meta } = useMonitoring();

  if (state.error && !state.monitoringData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Error al cargar los datos de monitoreo</h2>
            <p className="text-muted-foreground mb-4">{state.error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Panel de Monitoreo</h1>
          <p className="text-muted-foreground mt-2">Seguimiento en tiempo real de conductores y ejecución de rutas</p>
        </div>
        <div className="flex items-center gap-3">
          <CompanySelector
            companies={meta.companies as Array<{ id: string; commercialName: string }>}
            selectedCompanyId={meta.selectedCompanyId}
            authCompanyId={meta.authCompanyId}
            onCompanyChange={meta.setSelectedCompanyId}
            isSystemAdmin={meta.isSystemAdmin}
          />
          <Badge variant="outline" className="text-sm">
            <RefreshCw className="w-3 h-3 mr-1" />
            Actualizado: {actions.formatLastUpdate(state.lastUpdate)}
          </Badge>
          <Button variant="outline" size="sm" onClick={actions.handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button variant={state.alertsCount > 0 ? "destructive" : "outline"} size="sm" onClick={() => actions.setShowAlerts(!state.showAlerts)}>
            <Bell className="w-4 h-4 mr-2" />
            Alertas
            {state.alertsCount > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 min-w-[20px]">
                {state.alertsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {state.view === "overview" ? (
        <>
          {state.monitoringData && <MonitoringMetrics metrics={state.monitoringData.metrics} />}

          <div className={`grid gap-6 mt-6 ${state.showAlerts ? "grid-cols-1 lg:grid-cols-4" : "grid-cols-1 lg:grid-cols-3"}`}>
            <div className={state.showAlerts ? "lg:col-span-2" : "lg:col-span-2"}>
              <div className="h-[500px]">
                <MonitoringMap
                  jobId={state.monitoringData?.jobId || null}
                  companyId={meta.companyId!}
                  selectedDriverId={state.selectedDriverId}
                  onDriverSelect={actions.handleDriverClick}
                />
              </div>
            </div>

            <Card className="h-[500px] flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Conductores</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full px-6">
                  <div className="space-y-3 pb-4">
                    {state.isLoadingDrivers ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : state.driversData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No se encontraron conductores</div>
                    ) : (
                      state.driversData.map((driver) => (
                        <DriverListItem
                          key={driver.id}
                          id={driver.id}
                          name={driver.name}
                          status={driver.status}
                          fleetName={driver.fleetName}
                          hasRoute={driver.hasRoute}
                          vehiclePlate={driver.vehiclePlate}
                          progress={driver.progress}
                          alerts={driver.alerts}
                          onClick={() => actions.handleDriverClick(driver.id)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {state.showAlerts && meta.companyId && (
              <div className="lg:col-span-1">
                <div className="h-[500px]">
                  <AlertPanel companyId={meta.companyId} />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {state.isLoadingDetail ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : state.driverDetail ? (
            <DriverRouteDetail
              driver={state.driverDetail.driver}
              route={state.driverDetail.route}
              onClose={actions.handleBackToOverview}
              onRefresh={actions.handleDetailRefresh}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Error al cargar los detalles del conductor</CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
