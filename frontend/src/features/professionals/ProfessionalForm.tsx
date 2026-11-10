import { type FormEvent, useState } from "react";
import { TextField } from "../../components/form.tsx";
import { Alert } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import type { Service } from "../services/api.ts";
import type { Professional } from "./api.ts";

type Props = {
  initial?: Professional;
  services: Service[];
  submitLabel: string;
  saving: boolean;
  error: unknown;
  onSubmit: (input: { name: string; serviceIds: string[] }) => void;
  onCancel: () => void;
};

export function ProfessionalForm({ initial, services, submitLabel, saving, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(initial?.serviceIds ?? []);

  const apiError = error instanceof ApiError ? error : null;
  const prefix = initial ? `professional-${initial.id}` : "professional-new";

  function toggle(id: string) {
    setServiceIds(serviceIds.includes(id) ? serviceIds.filter((s) => s !== id) : [...serviceIds, id]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, serviceIds });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {apiError && apiError.issues.length === 0 && <Alert>{apiError.message}</Alert>}
      <TextField
        label="Nome"
        name={`${prefix}-name`}
        value={name}
        onChange={setName}
        error={apiError?.issues.find((i) => i.path === "name")?.message}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Serviços que realiza</legend>
        {services.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre serviços primeiro, na aba Serviços.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm has-checked:border-teal-600 has-checked:bg-teal-50"
              >
                <input
                  type="checkbox"
                  checked={serviceIds.includes(service.id)}
                  onChange={() => toggle(service.id)}
                  className="accent-teal-600"
                />
                {service.name}
                {!service.active && <span className="text-xs text-slate-500">(inativo)</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
      </div>
    </form>
  );
}
