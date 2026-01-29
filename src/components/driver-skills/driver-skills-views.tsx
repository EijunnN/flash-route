"use client";

import { Button } from "@/components/ui/button";
import { DriverSkillForm } from "./driver-skill-form";
import {
  useDriverSkills,
  VEHICLE_SKILL_CATEGORY_LABELS,
  EXPIRY_STATUS_LABELS,
  getCategoryColor,
  type DriverSkill,
} from "./driver-skills-context";

export function DriverSkillsListView() {
  const { state, actions } = useDriverSkills();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Habilidades de Conductores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Asigne y administre las habilidades y certificaciones de los conductores
            </p>
          </div>
          <Button onClick={() => actions.setShowForm(true)}>Asignar Habilidad</Button>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="filterDriver" className="block text-sm font-medium text-foreground mb-1">
                Conductor
              </label>
              <select
                id="filterDriver"
                value={state.filterDriver}
                onChange={(e) => actions.setFilterDriver(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                {state.drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filterCategory" className="block text-sm font-medium text-foreground mb-1">
                Categoría
              </label>
              <select
                id="filterCategory"
                value={state.filterCategory}
                onChange={(e) => actions.setFilterCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todas</option>
                {Object.entries(VEHICLE_SKILL_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filterStatus" className="block text-sm font-medium text-foreground mb-1">
                Estado
              </label>
              <select
                id="filterStatus"
                value={state.filterStatus}
                onChange={(e) => actions.setFilterStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
            <div>
              <label htmlFor="filterExpiry" className="block text-sm font-medium text-foreground mb-1">
                Vencimiento
              </label>
              <select
                id="filterExpiry"
                value={state.filterExpiry}
                onChange={(e) => actions.setFilterExpiry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="valid">Vigentes</option>
                <option value="expiring_soon">Prontos a vencer</option>
                <option value="expired">Vencidas</option>
              </select>
            </div>
          </div>
        </div>

        {state.isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : state.filteredDriverSkills.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center shadow-sm">
            <p className="text-muted-foreground">No hay habilidades asignadas. Asigne la primera habilidad a un conductor.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Conductor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Habilidad</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Fecha Obtención
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimiento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.filteredDriverSkills.map((driverSkill) => (
                    <DriverSkillRow key={driverSkill.id} driverSkill={driverSkill} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DriverSkillRow({ driverSkill }: { driverSkill: DriverSkill }) {
  const { actions } = useDriverSkills();

  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-foreground">{driverSkill.driver.name}</td>
      <td className="px-4 py-4 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{driverSkill.skill.name}</div>
        <div className="text-xs">{driverSkill.skill.code}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-4">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getCategoryColor(driverSkill.skill.category)}`}>
          {VEHICLE_SKILL_CATEGORY_LABELS[driverSkill.skill.category] || driverSkill.skill.category}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
        {new Date(driverSkill.obtainedAt).toLocaleDateString()}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm">
        {driverSkill.expiresAt ? (
          <div className="flex flex-col">
            <span>{new Date(driverSkill.expiresAt).toLocaleDateString()}</span>
            <span
              className={`text-xs ${driverSkill.expiryStatus === "expired" ? "text-destructive" : driverSkill.expiryStatus === "expiring_soon" ? "text-orange-500" : "text-muted-foreground"}`}
            >
              {EXPIRY_STATUS_LABELS[driverSkill.expiryStatus || "valid"]}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Sin vencimiento</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4">
        <button
          type="button"
          onClick={() => actions.handleToggleActive(driverSkill.id, driverSkill.active)}
          className={`inline-flex rounded-full px-2 text-xs font-semibold transition-colors ${
            driverSkill.active
              ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900/30 dark:text-gray-400"
          }`}
        >
          {driverSkill.active ? "Activo" : "Inactivo"}
        </button>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
        <button
          type="button"
          onClick={() => actions.setEditingDriverSkill(driverSkill)}
          className="text-muted-foreground hover:text-foreground mr-4 transition-colors"
        >
          Editar
        </button>
        {driverSkill.active && (
          <button
            type="button"
            onClick={() => actions.handleDelete(driverSkill.id)}
            className="text-destructive hover:text-destructive/80 transition-colors"
          >
            Desactivar
          </button>
        )}
      </td>
    </tr>
  );
}

export function DriverSkillsFormView() {
  const { state, actions } = useDriverSkills();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {state.editingDriverSkill ? "Editar Habilidad de Conductor" : "Asignar Nueva Habilidad"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.editingDriverSkill ? "Actualice la información de la habilidad asignada" : "Asigne una habilidad a un conductor"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <DriverSkillForm
            onSubmit={state.editingDriverSkill ? actions.handleUpdate : actions.handleCreate}
            initialData={
              state.editingDriverSkill
                ? {
                    driverId: state.editingDriverSkill.driverId,
                    skillId: state.editingDriverSkill.skillId,
                    obtainedAt: state.editingDriverSkill.obtainedAt,
                    expiresAt: state.editingDriverSkill.expiresAt || "",
                    active: state.editingDriverSkill.active,
                  }
                : undefined
            }
            drivers={state.drivers}
            skills={state.skills}
            submitLabel={state.editingDriverSkill ? "Actualizar" : "Asignar"}
          />
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={actions.cancelForm}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
