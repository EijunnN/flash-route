"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrderForm } from "./order-form-context";

export function OrderFormBasicInfo() {
  const { state, actions } = useOrderForm();
  const { formData, errors } = state;
  const { handleChange } = actions;

  return (
    <div className="border-b pb-4">
      <h3 className="font-medium mb-3">Basic Information</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="trackingId">Tracking ID *</Label>
          <Input
            id="trackingId"
            value={formData.trackingId}
            onChange={(e) => handleChange("trackingId", e.target.value)}
            placeholder="e.g., ORD-001"
          />
          {errors.trackingId && (
            <p className="text-sm text-destructive mt-1">{errors.trackingId}</p>
          )}
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => handleChange("status", e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="PENDING">Pending</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <Label htmlFor="customerName">Customer Name</Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => handleChange("customerName", e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div>
          <Label htmlFor="customerPhone">Phone</Label>
          <Input
            id="customerPhone"
            value={formData.customerPhone}
            onChange={(e) => handleChange("customerPhone", e.target.value)}
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="customerEmail">Email</Label>
        <Input
          id="customerEmail"
          type="email"
          value={formData.customerEmail}
          onChange={(e) => handleChange("customerEmail", e.target.value)}
          placeholder="john@example.com"
          autoComplete="email"
        />
        {errors.customerEmail && (
          <p className="text-sm text-destructive mt-1">{errors.customerEmail}</p>
        )}
      </div>
    </div>
  );
}

export function OrderFormLocation() {
  const { state, actions } = useOrderForm();
  const { formData, errors } = state;
  const { handleChange } = actions;

  return (
    <div className="border-b pb-4">
      <h3 className="font-medium mb-3">Location</h3>

      <div>
        <Label htmlFor="address">Address *</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => handleChange("address", e.target.value)}
          placeholder="123 Main St, City, Country"
        />
        {errors.address && (
          <p className="text-sm text-destructive mt-1">{errors.address}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <Label htmlFor="latitude">Latitude *</Label>
          <Input
            id="latitude"
            value={formData.latitude}
            onChange={(e) => handleChange("latitude", e.target.value)}
            placeholder="e.g., 40.7128"
            step="any"
          />
          {errors.latitude && (
            <p className="text-sm text-destructive mt-1">{errors.latitude}</p>
          )}
        </div>

        <div>
          <Label htmlFor="longitude">Longitude *</Label>
          <Input
            id="longitude"
            value={formData.longitude}
            onChange={(e) => handleChange("longitude", e.target.value)}
            placeholder="e.g., -74.0060"
            step="any"
          />
          {errors.longitude && (
            <p className="text-sm text-destructive mt-1">{errors.longitude}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderFormTimeWindow() {
  const { state, actions, derived } = useOrderForm();
  const { formData, timeWindowPresets, selectedPreset, isLoadingPresets } = state;
  const { handleChange, handlePresetChange, handleStrictnessChange } = actions;
  const { effectiveStrictness, isOverridden } = derived;

  return (
    <div className="border-b pb-4">
      <h3 className="font-medium mb-3">Time Window Configuration</h3>

      <div>
        <Label htmlFor="timeWindowPresetId">Time Window Preset</Label>
        {isLoadingPresets ? (
          <p className="text-sm text-muted-foreground">Loading presets...</p>
        ) : (
          <select
            id="timeWindowPresetId"
            value={formData.timeWindowPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="">No preset</option>
            {timeWindowPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} ({preset.type}, {preset.strictness})
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedPreset && (
        <div className="mt-3 p-3 bg-muted/50 rounded-md">
          <p className="text-sm font-medium">Preset Details:</p>
          <p className="text-sm text-muted-foreground">
            Type: {selectedPreset.type}
            {selectedPreset.type === "EXACT"
              ? ` - ${selectedPreset.exactTime} ±${selectedPreset.toleranceMinutes}min`
              : ` - ${selectedPreset.startTime} - ${selectedPreset.endTime}`}
          </p>
          <p className="text-sm text-muted-foreground">
            Preset Strictness:{" "}
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                selectedPreset.strictness === "HARD"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-yellow-500/10 text-yellow-600"
              }`}
            >
              {selectedPreset.strictness}
            </span>
          </p>
        </div>
      )}

      <div className="mt-3">
        <Label htmlFor="strictness">Strictness</Label>
        <select
          id="strictness"
          value={formData.strictness || "INHERIT"}
          onChange={(e) => handleStrictnessChange(e.target.value)}
          disabled={!selectedPreset}
          className="w-full px-3 py-2 border rounded-md bg-background disabled:opacity-50"
        >
          <option value="INHERIT">
            {selectedPreset
              ? `Inherit from preset (${selectedPreset.strictness})`
              : "Select a preset first"}
          </option>
          <option value="HARD">Hard (reject violations)</option>
          <option value="SOFT">Soft (minimize delays)</option>
        </select>
        {isOverridden && selectedPreset && (
          <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
            <span className="font-medium">Override:</span> This order will use{" "}
            <span className="font-medium">{effectiveStrictness}</span> strictness
            instead of the preset's {selectedPreset.strictness}
          </p>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="promisedDate">Promised Date</Label>
        <Input
          id="promisedDate"
          type="date"
          value={formData.promisedDate}
          onChange={(e) => handleChange("promisedDate", e.target.value)}
        />
      </div>
    </div>
  );
}

export function OrderFormCapacity() {
  const { state, actions } = useOrderForm();
  const { formData, companyProfile } = state;
  const { handleChange } = actions;

  return (
    <div className="border-b pb-4">
      <h3 className="font-medium mb-3">Requisitos de Capacidad</h3>

      <div className="grid grid-cols-2 gap-4">
        {companyProfile.enableWeight && (
          <div>
            <Label htmlFor="weightRequired">Peso (gramos)</Label>
            <Input
              id="weightRequired"
              type="number"
              min="0"
              value={formData.weightRequired || ""}
              onChange={(e) =>
                handleChange("weightRequired", parseInt(e.target.value, 10) || 0)
              }
              placeholder="Ej: 500"
            />
          </div>
        )}

        {companyProfile.enableVolume && (
          <div>
            <Label htmlFor="volumeRequired">Volumen (litros)</Label>
            <Input
              id="volumeRequired"
              type="number"
              min="0"
              value={formData.volumeRequired || ""}
              onChange={(e) =>
                handleChange("volumeRequired", parseInt(e.target.value, 10) || 0)
              }
              placeholder="Ej: 10"
            />
          </div>
        )}

        {companyProfile.enableOrderValue && (
          <div>
            <Label htmlFor="orderValue">Valorizado</Label>
            <Input
              id="orderValue"
              type="number"
              min="0"
              value={formData.orderValue || ""}
              onChange={(e) =>
                handleChange("orderValue", parseInt(e.target.value, 10) || 0)
              }
              placeholder="Ej: 15000 = $150.00"
            />
          </div>
        )}

        {companyProfile.enableUnits && (
          <div>
            <Label htmlFor="unitsRequired">Unidades</Label>
            <Input
              id="unitsRequired"
              type="number"
              min="1"
              value={formData.unitsRequired || ""}
              onChange={(e) =>
                handleChange("unitsRequired", parseInt(e.target.value, 10) || 1)
              }
              placeholder="Ej: 3"
            />
          </div>
        )}
      </div>

      {companyProfile.enableOrderType && (
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <Label htmlFor="orderType">Tipo de Pedido</Label>
            <select
              id="orderType"
              value={formData.orderType || ""}
              onChange={(e) => handleChange("orderType", e.target.value || null)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Sin tipo</option>
              <option value="NEW">Nuevo</option>
              <option value="RESCHEDULED">Reprogramado</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div>
            <Label htmlFor="priority">Prioridad (0-100)</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              max="100"
              value={formData.priority || ""}
              onChange={(e) =>
                handleChange("priority", parseInt(e.target.value, 10) || 50)
              }
              placeholder="50"
            />
          </div>
        </div>
      )}

      <div className="mt-3">
        <Label htmlFor="requiredSkills">
          Habilidades Requeridas (separadas por coma)
        </Label>
        <Input
          id="requiredSkills"
          value={formData.requiredSkills}
          onChange={(e) => handleChange("requiredSkills", e.target.value)}
          placeholder="Ej: REFRIGERADO, FRAGIL"
        />
      </div>
    </div>
  );
}

export function OrderFormNotes() {
  const { state, actions, derived } = useOrderForm();
  const { formData } = state;
  const { handleChange } = actions;
  const { isEditing } = derived;

  return (
    <>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Additional delivery instructions..."
          rows={3}
          className="w-full px-3 py-2 border rounded-md bg-background resize-none"
        />
      </div>

      {isEditing && (
        <div className="flex items-center gap-2">
          <input
            id="active"
            type="checkbox"
            checked={formData.active ?? true}
            onChange={(e) => handleChange("active", e.target.checked)}
          />
          <Label htmlFor="active" className="cursor-pointer">
            Active
          </Label>
        </div>
      )}
    </>
  );
}

export function OrderFormActions() {
  const { state, meta } = useOrderForm();
  const { errors, isSubmitting } = state;
  const { submitLabel, onCancel } = meta;

  return (
    <>
      {errors.form && (
        <p className="text-sm text-destructive">{errors.form}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </>
  );
}
