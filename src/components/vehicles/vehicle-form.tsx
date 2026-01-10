"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VehicleInput } from "@/lib/validations/vehicle";

interface VehicleFormProps {
  onSubmit: (data: VehicleInput) => Promise<void>;
  initialData?: Partial<VehicleInput>;
  fleets: Array<{ id: string; name: string }>;
  submitLabel?: string;
}

const VEHICLE_TYPES = [
  { value: "TRUCK", label: "Camión" },
  { value: "VAN", label: "Furgoneta" },
  { value: "SEMI_TRUCK", label: "Semirremolque" },
  { value: "PICKUP", label: "Pickup" },
  { value: "TRAILER", label: "Remolque" },
  { value: "REFRIGERATED_TRUCK", label: "Camión Refrigerado" },
];

const VEHICLE_STATUS = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "IN_MAINTENANCE", label: "En Mantenimiento" },
  { value: "ASSIGNED", label: "Asignado" },
  { value: "INACTIVE", label: "Inactivo" },
];

const LICENSE_CATEGORIES = [
  { value: "B", label: "B (Automóviles)" },
  { value: "C", label: "C (Camiones > 3.5t)" },
  { value: "C1", label: "C1 (Camiones 3.5t-7.5t)" },
  { value: "CE", label: "CE (Camiones con remolque)" },
  { value: "D", label: "D (Autobuses)" },
  { value: "D1", label: "D1 (Autobuses pequeños)" },
  { value: "DE", label: "DE (Autobuses con remolque)" },
];

export function VehicleForm({
  onSubmit,
  initialData,
  fleets,
  submitLabel = "Guardar",
}: VehicleFormProps) {
  const defaultData: VehicleInput = {
    fleetId: initialData?.fleetId ?? fleets[0]?.id ?? "",
    plate: initialData?.plate ?? "",
    brand: initialData?.brand ?? "",
    model: initialData?.model ?? "",
    year: initialData?.year ?? new Date().getFullYear(),
    type: initialData?.type ?? "TRUCK",
    weightCapacity: initialData?.weightCapacity ?? 0,
    volumeCapacity: initialData?.volumeCapacity ?? 0,
    refrigerated: initialData?.refrigerated ?? false,
    heated: initialData?.heated ?? false,
    lifting: initialData?.lifting ?? false,
    licenseRequired: initialData?.licenseRequired,
    insuranceExpiry: initialData?.insuranceExpiry ?? "",
    inspectionExpiry: initialData?.inspectionExpiry ?? "",
    status: initialData?.status ?? "AVAILABLE",
    active: initialData?.active ?? true,
  };

  const [formData, setFormData] = useState<VehicleInput>(defaultData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error: any) {
      if (error.details) {
        const fieldErrors: Record<string, string> = {};
        error.details.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ form: error.error || "Error al guardar el vehículo" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof VehicleInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.form && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Fleet Selection */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fleetId">Flota *</Label>
          <select
            id="fleetId"
            value={formData.fleetId}
            onChange={(e) => updateField("fleetId", e.target.value)}
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors"
          >
            {fleets.length === 0 ? (
              <option value="">No hay flotas disponibles</option>
            ) : (
              fleets.map((fleet) => (
                <option key={fleet.id} value={fleet.id}>
                  {fleet.name}
                </option>
              ))
            )}
          </select>
          {errors.fleetId && (
            <p className="text-sm text-destructive">{errors.fleetId}</p>
          )}
        </div>

        {/* Plate */}
        <div className="space-y-2">
          <Label htmlFor="plate">Matrícula *</Label>
          <Input
            id="plate"
            value={formData.plate}
            onChange={(e) => updateField("plate", e.target.value)}
            disabled={isSubmitting}
            className={errors.plate ? "border-destructive focus-visible:ring-destructive" : ""}
            placeholder="Ej: ABC-1234"
          />
          {errors.plate && (
            <p className="text-sm text-destructive">{errors.plate}</p>
          )}
        </div>

        {/* Brand */}
        <div className="space-y-2">
          <Label htmlFor="brand">Marca *</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e) => updateField("brand", e.target.value)}
            disabled={isSubmitting}
            className={errors.brand ? "border-destructive focus-visible:ring-destructive" : ""}
            placeholder="Ej: Scania"
          />
          {errors.brand && (
            <p className="text-sm text-destructive">{errors.brand}</p>
          )}
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="model">Modelo *</Label>
          <Input
            id="model"
            value={formData.model}
            onChange={(e) => updateField("model", e.target.value)}
            disabled={isSubmitting}
            className={errors.model ? "border-destructive focus-visible:ring-destructive" : ""}
            placeholder="Ej: R450"
          />
          {errors.model && (
            <p className="text-sm text-destructive">{errors.model}</p>
          )}
        </div>

        {/* Year */}
        <div className="space-y-2">
          <Label htmlFor="year">Año *</Label>
          <Input
            id="year"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            value={formData.year}
            onChange={(e) => updateField("year", parseInt(e.target.value) || new Date().getFullYear())}
            disabled={isSubmitting}
            className={errors.year ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.year && (
            <p className="text-sm text-destructive">{errors.year}</p>
          )}
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label htmlFor="type">Tipo de Vehículo *</Label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => updateField("type", e.target.value)}
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors"
          >
            {VEHICLE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type}</p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Estado *</Label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => updateField("status", e.target.value)}
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors"
          >
            {VEHICLE_STATUS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          {errors.status && (
            <p className="text-sm text-destructive">{errors.status}</p>
          )}
        </div>

        {/* Weight Capacity */}
        <div className="space-y-2">
          <Label htmlFor="weightCapacity">Capacidad de Peso (kg) *</Label>
          <Input
            id="weightCapacity"
            type="number"
            min="1"
            step="1"
            value={formData.weightCapacity}
            onChange={(e) => updateField("weightCapacity", parseInt(e.target.value) || 0)}
            disabled={isSubmitting}
            className={errors.weightCapacity ? "border-destructive focus-visible:ring-destructive" : ""}
            placeholder="Ej: 5000"
          />
          {errors.weightCapacity && (
            <p className="text-sm text-destructive">{errors.weightCapacity}</p>
          )}
        </div>

        {/* Volume Capacity */}
        <div className="space-y-2">
          <Label htmlFor="volumeCapacity">Capacidad de Volumen (m³) *</Label>
          <Input
            id="volumeCapacity"
            type="number"
            min="1"
            step="1"
            value={formData.volumeCapacity}
            onChange={(e) => updateField("volumeCapacity", parseInt(e.target.value) || 0)}
            disabled={isSubmitting}
            className={errors.volumeCapacity ? "border-destructive focus-visible:ring-destructive" : ""}
            placeholder="Ej: 50"
          />
          {errors.volumeCapacity && (
            <p className="text-sm text-destructive">{errors.volumeCapacity}</p>
          )}
        </div>

        {/* License Required */}
        <div className="space-y-2">
          <Label htmlFor="licenseRequired">Licencia Requerida</Label>
          <select
            id="licenseRequired"
            value={formData.licenseRequired ?? ""}
            onChange={(e) => updateField("licenseRequired", e.target.value || undefined)}
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors"
          >
            <option value="">Ninguna</option>
            {LICENSE_CATEGORIES.map((license) => (
              <option key={license.value} value={license.value}>
                {license.label}
              </option>
            ))}
          </select>
          {errors.licenseRequired && (
            <p className="text-sm text-destructive">{errors.licenseRequired}</p>
          )}
        </div>

        {/* Insurance Expiry */}
        <div className="space-y-2">
          <Label htmlFor="insuranceExpiry">Vencimiento del Seguro</Label>
          <Input
            id="insuranceExpiry"
            type="datetime-local"
            value={formData.insuranceExpiry ? formData.insuranceExpiry.slice(0, 16) : ""}
            onChange={(e) => updateField("insuranceExpiry", e.target.value || "")}
            disabled={isSubmitting}
            className={errors.insuranceExpiry ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.insuranceExpiry && (
            <p className="text-sm text-destructive">{errors.insuranceExpiry}</p>
          )}
        </div>

        {/* Inspection Expiry */}
        <div className="space-y-2">
          <Label htmlFor="inspectionExpiry">Vencimiento de Inspección</Label>
          <Input
            id="inspectionExpiry"
            type="datetime-local"
            value={formData.inspectionExpiry ? formData.inspectionExpiry.slice(0, 16) : ""}
            onChange={(e) => updateField("inspectionExpiry", e.target.value || "")}
            disabled={isSubmitting}
            className={errors.inspectionExpiry ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.inspectionExpiry && (
            <p className="text-sm text-destructive">{errors.inspectionExpiry}</p>
          )}
        </div>

        {/* Features checkboxes */}
        <div className="space-y-4 sm:col-span-2 border-t pt-4">
          <h3 className="text-sm font-medium">Características Especiales</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <input
                id="refrigerated"
                type="checkbox"
                checked={formData.refrigerated}
                onChange={(e) => updateField("refrigerated", e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-ring"
              />
              <Label htmlFor="refrigerated" className="text-sm cursor-pointer">
                Refrigerado
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="heated"
                type="checkbox"
                checked={formData.heated}
                onChange={(e) => updateField("heated", e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-ring"
              />
              <Label htmlFor="heated" className="text-sm cursor-pointer">
                Con Calefacción
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="lifting"
                type="checkbox"
                checked={formData.lifting}
                onChange={(e) => updateField("lifting", e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-ring"
              />
              <Label htmlFor="lifting" className="text-sm cursor-pointer">
                Con Elevación
              </Label>
            </div>
          </div>
        </div>

        {/* Active status */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="active">Estado del Registro</Label>
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={formData.active}
              onChange={(e) => updateField("active", e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">
              {formData.active ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
