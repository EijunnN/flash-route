"use client";

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { useCompanyContext } from "@/hooks/use-company-context";

export interface OptimizationPreset {
  id: string;
  name: string;
  description: string | null;
  balanceVisits: boolean;
  minimizeVehicles: boolean;
  openStart: boolean;
  openEnd: boolean;
  mergeSimilar: boolean;
  mergeSimilarV2: boolean;
  oneRoutePerVehicle: boolean;
  simplify: boolean;
  bigVrp: boolean;
  flexibleTimeWindows: boolean;
  mergeByDistance: boolean;
  groupSameLocation: boolean;
  maxDistanceKm: number | null;
  vehicleRechargeTime: number | null;
  trafficFactor: number | null;
  routeEndMode: "DRIVER_ORIGIN" | "SPECIFIC_DEPOT" | "OPEN_END";
  endDepotLatitude: string | null;
  endDepotLongitude: string | null;
  endDepotAddress: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ROUTE_END_MODES = [
  { value: "DRIVER_ORIGIN", label: "Origen del conductor", description: "Cada ruta termina donde inició el conductor" },
  { value: "SPECIFIC_DEPOT", label: "Depot específico", description: "Todas las rutas terminan en un punto fijo" },
  { value: "OPEN_END", label: "Fin abierto", description: "Las rutas terminan en la última parada" },
] as const;

export const DEFAULT_PRESET: Partial<OptimizationPreset> = {
  name: "",
  description: "",
  balanceVisits: false,
  minimizeVehicles: false,
  openStart: false,
  openEnd: false,
  mergeSimilar: true,
  mergeSimilarV2: false,
  oneRoutePerVehicle: true,
  simplify: true,
  bigVrp: true,
  flexibleTimeWindows: false,
  mergeByDistance: false,
  groupSameLocation: true,
  maxDistanceKm: 200,
  vehicleRechargeTime: 0,
  trafficFactor: 50,
  routeEndMode: "DRIVER_ORIGIN",
  endDepotLatitude: null,
  endDepotLongitude: null,
  endDepotAddress: null,
  isDefault: false,
};

export interface PresetsState {
  presets: OptimizationPreset[];
  isLoading: boolean;
  dialogOpen: boolean;
  editingPreset: Partial<OptimizationPreset> | null;
  isSaving: boolean;
}

export interface PresetsActions {
  fetchPresets: () => Promise<void>;
  handleCreate: () => void;
  handleEdit: (preset: OptimizationPreset) => void;
  handleSave: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleSetDefault: (preset: OptimizationPreset) => Promise<void>;
  setDialogOpen: (open: boolean) => void;
  setEditingPreset: (preset: Partial<OptimizationPreset> | null) => void;
  updateEditingPreset: (updates: Partial<OptimizationPreset>) => void;
}

export interface PresetsMeta {
  companyId: string | null;
  isReady: boolean;
  isSystemAdmin: boolean;
  companies: Array<{ id: string; commercialName: string }>;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  authCompanyId: string | null;
}

interface PresetsContextValue {
  state: PresetsState;
  actions: PresetsActions;
  meta: PresetsMeta;
}

const PresetsContext = createContext<PresetsContextValue | undefined>(undefined);

export function PresetsProvider({ children }: { children: ReactNode }) {
  const {
    effectiveCompanyId: companyId,
    isReady,
    isSystemAdmin,
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    authCompanyId,
  } = useCompanyContext();

  const [presets, setPresets] = useState<OptimizationPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Partial<OptimizationPreset> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!companyId || !isReady) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/optimization-presets", {
        headers: { "x-company-id": companyId },
      });
      const data = await response.json();
      setPresets(data.data || []);
    } catch (error) {
      console.error("Error fetching presets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, isReady]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const handleCreate = useCallback(() => {
    setEditingPreset({ ...DEFAULT_PRESET });
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((preset: OptimizationPreset) => {
    setEditingPreset({ ...preset });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingPreset || !companyId) return;
    setIsSaving(true);
    try {
      const isEditing = !!editingPreset.id;
      const url = isEditing
        ? `/api/optimization-presets/${editingPreset.id}`
        : "/api/optimization-presets";

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId,
        },
        body: JSON.stringify(editingPreset),
      });

      if (response.ok) {
        setDialogOpen(false);
        setEditingPreset(null);
        fetchPresets();
      }
    } catch (error) {
      console.error("Error saving preset:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editingPreset, companyId, fetchPresets]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!companyId || !confirm("¿Estás seguro de eliminar este preset?")) return;
      try {
        await fetch(`/api/optimization-presets/${id}`, {
          method: "DELETE",
          headers: { "x-company-id": companyId },
        });
        fetchPresets();
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    },
    [companyId, fetchPresets]
  );

  const handleSetDefault = useCallback(
    async (preset: OptimizationPreset) => {
      if (!companyId) return;
      try {
        await fetch(`/api/optimization-presets/${preset.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-company-id": companyId,
          },
          body: JSON.stringify({ isDefault: true }),
        });
        fetchPresets();
      } catch (error) {
        console.error("Error setting default:", error);
      }
    },
    [companyId, fetchPresets]
  );

  const updateEditingPreset = useCallback((updates: Partial<OptimizationPreset>) => {
    setEditingPreset((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const state: PresetsState = { presets, isLoading, dialogOpen, editingPreset, isSaving };

  const actions: PresetsActions = {
    fetchPresets,
    handleCreate,
    handleEdit,
    handleSave,
    handleDelete,
    handleSetDefault,
    setDialogOpen,
    setEditingPreset,
    updateEditingPreset,
  };

  const meta: PresetsMeta = {
    companyId,
    isReady,
    isSystemAdmin,
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    authCompanyId,
  };

  return <PresetsContext value={{ state, actions, meta }}>{children}</PresetsContext>;
}

export function usePresets(): PresetsContextValue {
  const context = use(PresetsContext);
  if (context === undefined) {
    throw new Error("usePresets must be used within a PresetsProvider");
  }
  return context;
}
