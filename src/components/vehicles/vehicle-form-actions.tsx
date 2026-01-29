"use client";

import { Button } from "@/components/ui/button";
import { useVehicleForm } from "./vehicle-form-context";

export function VehicleFormActions() {
  const { state, meta } = useVehicleForm();
  const { isSubmitting } = state;
  const { submitLabel, onCancel } = meta;

  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : submitLabel}
      </Button>
    </div>
  );
}
