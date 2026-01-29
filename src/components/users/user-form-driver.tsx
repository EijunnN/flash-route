"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserForm } from "./user-form-context";

const DRIVER_STATUS = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "ASSIGNED", label: "Asignado" },
  { value: "IN_ROUTE", label: "En Ruta" },
  { value: "ON_PAUSE", label: "En Pausa" },
  { value: "UNAVAILABLE", label: "No Disponible" },
];

const LICENSE_CATEGORIES = [
  "A",
  "A1",
  "A2",
  "B",
  "C",
  "C1",
  "CE",
  "D",
  "D1",
  "DE",
];

export function UserFormDriver() {
  const { state, actions, meta, derived } = useUserForm();
  const { formData, errors, isSubmitting, selectedLicenseCategories } = state;
  const { updateField, toggleLicenseCategory } = actions;
  const { fleets } = meta;
  const { licenseStatus } = derived;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="primaryFleetId" className="text-xs">
            Flota Principal
          </Label>
          <Select
            value={formData.primaryFleetId ?? "none"}
            onValueChange={(value) =>
              updateField("primaryFleetId", value === "none" ? null : value)
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin flota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin flota</SelectItem>
              {fleets.map((fleet) => (
                <SelectItem key={fleet.id} value={fleet.id}>
                  {fleet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="driverStatus" className="text-xs">
            Estado
          </Label>
          <Select
            value={formData.driverStatus ?? "AVAILABLE"}
            onValueChange={(value) => updateField("driverStatus", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRIVER_STATUS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="identification" className="text-xs">
            Identificación *
          </Label>
          <Input
            id="identification"
            value={formData.identification ?? ""}
            onChange={(e) => updateField("identification", e.target.value)}
            disabled={isSubmitting}
            className={errors.identification ? "border-destructive" : ""}
            placeholder="12345678"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="birthDate" className="text-xs">
            Fecha Nacimiento
          </Label>
          <Input
            id="birthDate"
            type="date"
            value={formData.birthDate ? formData.birthDate.slice(0, 10) : ""}
            onChange={(e) =>
              updateField(
                "birthDate",
                e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
              )
            }
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="licenseNumber" className="text-xs">
            Nº Licencia *
          </Label>
          <Input
            id="licenseNumber"
            value={formData.licenseNumber ?? ""}
            onChange={(e) => updateField("licenseNumber", e.target.value)}
            disabled={isSubmitting}
            className={errors.licenseNumber ? "border-destructive" : ""}
            placeholder="LIC-12345"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="licenseExpiry" className="text-xs">
            Vencimiento Licencia *
          </Label>
          <Input
            id="licenseExpiry"
            type="date"
            value={
              formData.licenseExpiry ? formData.licenseExpiry.slice(0, 10) : ""
            }
            onChange={(e) =>
              updateField(
                "licenseExpiry",
                e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
              )
            }
            disabled={isSubmitting}
            className={errors.licenseExpiry ? "border-destructive" : ""}
          />
          {licenseStatus === "expired" && (
            <p className="text-xs text-destructive">Licencia vencida</p>
          )}
          {licenseStatus === "expiring_soon" && (
            <p className="text-xs text-orange-500">Vence pronto</p>
          )}
        </div>
      </div>

      <div className="space-y-1 pt-2">
        <Label className="text-xs">Categorías de Licencia</Label>
        <div className="flex flex-wrap gap-2">
          {LICENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleLicenseCategory(cat)}
              disabled={isSubmitting}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                selectedLicenseCategories.includes(cat)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:bg-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="certifications" className="text-xs">
          Certificaciones
        </Label>
        <Input
          id="certifications"
          value={formData.certifications ?? ""}
          onChange={(e) =>
            updateField("certifications", e.target.value || null)
          }
          disabled={isSubmitting}
          placeholder="Carga peligrosa, Primeros auxilios..."
        />
      </div>
    </div>
  );
}
