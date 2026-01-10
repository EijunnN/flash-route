"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/companies/company-form";
import type { CompanyInput } from "@/lib/validations/company";

interface Company {
  id: string;
  legalName: string;
  commercialName: string;
  email: string;
  phone: string | null;
  taxAddress: string | null;
  country: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/companies");
      const data = await response.json();
      setCompanies(data.data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreate = async (data: CompanyInput) => {
    const response = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    await fetchCompanies();
    setShowForm(false);
  };

  const handleUpdate = async (data: CompanyInput) => {
    if (!editingCompany) return;

    const response = await fetch(`/api/companies/${editingCompany.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    await fetchCompanies();
    setEditingCompany(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de desactivar esta empresa?")) return;

    const response = await fetch(`/api/companies/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchCompanies();
    }
  };

  if (showForm || editingCompany) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {editingCompany ? "Editar Empresa" : "Nueva Empresa"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {editingCompany
                ? "Actualice la información de la empresa"
                : "Complete el formulario para crear una nueva empresa"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <CompanyForm
              onSubmit={editingCompany ? handleUpdate : handleCreate}
              initialData={
                editingCompany
                  ? {
                      ...editingCompany,
                      phone: editingCompany.phone ?? undefined,
                      taxAddress: editingCompany.taxAddress ?? undefined,
                    }
                  : undefined
              }
              submitLabel={editingCompany ? "Actualizar" : "Crear"}
            />
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingCompany(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Gestión de Empresas
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Administre las empresas inquilinas del sistema
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>Nueva Empresa</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-zinc-600 dark:text-zinc-400">
              No hay empresas registradas. Cree la primera empresa.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Nombre Legal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Nombre Comercial
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    País
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {company.legalName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {company.commercialName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {company.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zocal-400">
                      {company.country}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                          company.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {company.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => setEditingCompany(company)}
                        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 mr-4"
                      >
                        Editar
                      </button>
                      {company.active && (
                        <button
                          onClick={() => handleDelete(company.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
