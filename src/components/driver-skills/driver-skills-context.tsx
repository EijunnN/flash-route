"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCompanyContext } from "@/hooks/use-company-context";
import type { DriverSkillInput } from "@/lib/validations/driver-skill";

export interface DriverSkill {
  id: string;
  driverId: string;
  skillId: string;
  obtainedAt: string;
  expiresAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  skill: { id: string; code: string; name: string; category: string; description?: string };
  driver: { id: string; name: string; identification: string };
  expiryStatus?: string;
}

export interface Driver {
  id: string;
  name: string;
  identification: string;
}

export interface VehicleSkill {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  active: boolean;
}

export const VEHICLE_SKILL_CATEGORY_LABELS: Record<string, string> = {
  EQUIPMENT: "Equipamiento",
  TEMPERATURE: "Temperatura",
  CERTIFICATIONS: "Certificaciones",
  SPECIAL: "Especiales",
};

export const EXPIRY_STATUS_LABELS: Record<string, string> = {
  valid: "Vigente",
  expiring_soon: "Pronto a vencer",
  expired: "Vencida",
};

export const getCategoryColor = (category: string) => {
  switch (category) {
    case "EQUIPMENT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "TEMPERATURE":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
    case "CERTIFICATIONS":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "SPECIAL":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

export interface DriverSkillsState {
  driverSkills: DriverSkill[];
  filteredDriverSkills: DriverSkill[];
  drivers: Driver[];
  skills: VehicleSkill[];
  isLoading: boolean;
  showForm: boolean;
  editingDriverSkill: DriverSkill | null;
  filterDriver: string;
  filterStatus: string;
  filterCategory: string;
  filterExpiry: string;
}

export interface DriverSkillsActions {
  handleCreate: (data: DriverSkillInput) => Promise<void>;
  handleUpdate: (data: DriverSkillInput) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleToggleActive: (id: string, currentActive: boolean) => Promise<void>;
  setShowForm: (show: boolean) => void;
  setEditingDriverSkill: (skill: DriverSkill | null) => void;
  setFilterDriver: (driver: string) => void;
  setFilterStatus: (status: string) => void;
  setFilterCategory: (category: string) => void;
  setFilterExpiry: (expiry: string) => void;
  cancelForm: () => void;
}

export interface DriverSkillsMeta {
  companyId: string | null;
  isReady: boolean;
  isSystemAdmin: boolean;
  companies: Array<{ id: string; commercialName: string }>;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  authCompanyId: string | null;
}

interface DriverSkillsContextValue {
  state: DriverSkillsState;
  actions: DriverSkillsActions;
  meta: DriverSkillsMeta;
}

const DriverSkillsContext = createContext<DriverSkillsContextValue | undefined>(undefined);

export function DriverSkillsProvider({ children }: { children: ReactNode }) {
  const { effectiveCompanyId: companyId, isReady, isSystemAdmin, companies, selectedCompanyId, setSelectedCompanyId, authCompanyId } =
    useCompanyContext();

  const [driverSkills, setDriverSkills] = useState<DriverSkill[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [skills, setSkills] = useState<VehicleSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDriverSkill, setEditingDriverSkill] = useState<DriverSkill | null>(null);
  const [filterDriver, setFilterDriver] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterExpiry, setFilterExpiry] = useState<string>("");

  const fetchDriverSkills = useCallback(async () => {
    if (!companyId) return;
    try {
      const params = new URLSearchParams();
      if (filterDriver) params.append("driverId", filterDriver);
      if (filterStatus) params.append("active", filterStatus);
      if (filterExpiry) params.append("status", filterExpiry);
      const response = await fetch(`/api/driver-skills?${params.toString()}`, { headers: { "x-company-id": companyId } });
      const data = await response.json();
      setDriverSkills(data.data || []);
    } catch (error) {
      console.error("Error fetching driver skills:", error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, filterDriver, filterStatus, filterExpiry]);

  const fetchDrivers = useCallback(async () => {
    if (!companyId) return;
    try {
      const response = await fetch("/api/drivers?active=true", { headers: { "x-company-id": companyId } });
      const data = await response.json();
      setDrivers(data.data || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  }, [companyId]);

  const fetchSkills = useCallback(async () => {
    if (!companyId) return;
    try {
      const response = await fetch("/api/vehicle-skills?active=true", { headers: { "x-company-id": companyId } });
      const data = await response.json();
      setSkills(data.data || []);
    } catch (error) {
      console.error("Error fetching vehicle skills:", error);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDriverSkills();
    fetchDrivers();
    fetchSkills();
  }, [fetchDriverSkills, fetchDrivers, fetchSkills]);

  const handleCreate = useCallback(
    async (data: DriverSkillInput) => {
      const response = await fetch("/api/driver-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-company-id": companyId ?? "" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      await fetchDriverSkills();
      setShowForm(false);
    },
    [companyId, fetchDriverSkills]
  );

  const handleUpdate = useCallback(
    async (data: DriverSkillInput) => {
      if (!editingDriverSkill) return;
      const response = await fetch(`/api/driver-skills/${editingDriverSkill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-company-id": companyId ?? "" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      await fetchDriverSkills();
      setEditingDriverSkill(null);
    },
    [editingDriverSkill, companyId, fetchDriverSkills]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("¿Está seguro de desactivar esta habilidad del conductor?")) return;
      const response = await fetch(`/api/driver-skills/${id}`, {
        method: "DELETE",
        headers: { "x-company-id": companyId ?? "" },
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || error.details || "Error al desactivar la habilidad");
        return;
      }
      await fetchDriverSkills();
    },
    [companyId, fetchDriverSkills]
  );

  const handleToggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      const response = await fetch(`/api/driver-skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-company-id": companyId ?? "" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || error.details || "Error al actualizar el estado");
        return;
      }
      await fetchDriverSkills();
    },
    [companyId, fetchDriverSkills]
  );

  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingDriverSkill(null);
  }, []);

  const filteredDriverSkills = useMemo(() => {
    if (!filterCategory) return driverSkills;
    return driverSkills.filter((ds) => ds.skill.category === filterCategory);
  }, [driverSkills, filterCategory]);

  const state: DriverSkillsState = {
    driverSkills,
    filteredDriverSkills,
    drivers,
    skills,
    isLoading,
    showForm,
    editingDriverSkill,
    filterDriver,
    filterStatus,
    filterCategory,
    filterExpiry,
  };

  const actions: DriverSkillsActions = {
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggleActive,
    setShowForm,
    setEditingDriverSkill,
    setFilterDriver,
    setFilterStatus,
    setFilterCategory,
    setFilterExpiry,
    cancelForm,
  };

  const meta: DriverSkillsMeta = { companyId, isReady, isSystemAdmin, companies, selectedCompanyId, setSelectedCompanyId, authCompanyId };

  return <DriverSkillsContext value={{ state, actions, meta }}>{children}</DriverSkillsContext>;
}

export function useDriverSkills(): DriverSkillsContextValue {
  const context = use(DriverSkillsContext);
  if (context === undefined) {
    throw new Error("useDriverSkills must be used within a DriverSkillsProvider");
  }
  return context;
}
