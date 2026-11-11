import { type FormEvent, useState } from "react";
import { TextField } from "../../components/form.tsx";
import { Alert } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { centsToInput, parsePriceToCents } from "../../lib/money.ts";
import type { Service, ServiceInput } from "./api.ts";

type Props = {
  initial?: Service;
  submitLabel: string;
  saving: boolean;
  error: unknown;
  onSubmit: (input: ServiceInput) => void;
  onCancel?: () => void;
};

export function ServiceForm({ initial, submitLabel, saving, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [duration, setDuration] = useState(initial ? String(initial.durationMinutes) : "30");
  const [price, setPrice] = useState(initial ? centsToInput(initial.priceCents) : "");
  const [priceError, setPriceError] = useState<string | undefined>();

  const apiError = error instanceof ApiError ? error : null;
  const errorFor = (path: string) => apiError?.issues.find((i) => i.path === path)?.message;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const priceCents = parsePriceToCents(price);
    if (priceCents === null) {
      setPriceError('Use um valor como "35,00".');
      return;
    }
    setPriceError(undefined);
    onSubmit({ name, durationMinutes: Number(duration), priceCents });
  }

  // Prefixo do id: o mesmo formulário aparece para criar e para editar, na mesma tela.
  const prefix = initial ? `service-${initial.id}` : "service-new";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {apiError && apiError.issues.length === 0 && <Alert>{apiError.message}</Alert>}
      <TextField label="Nome do serviço" name={`${prefix}-name`} value={name} onChange={setName} error={errorFor("name")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Duração (minutos)"
          name={`${prefix}-duration`}
          type="number"
          value={duration}
          onChange={setDuration}
          error={errorFor("durationMinutes")}
        />
        <TextField
          label="Preço (R$)"
          name={`${prefix}-price`}
          placeholder="35,00"
          value={price}
          onChange={setPrice}
          error={priceError ?? errorFor("priceCents")}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
