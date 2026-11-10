import { useState } from "react";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { formatDuration, formatPrice } from "../../lib/format.ts";
import { type Service, useCreateService, useServices, useUpdateService } from "./api.ts";
import { ServiceForm } from "./ServiceForm.tsx";

export function ServicesPage() {
  const services = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Serviços</h1>
          <p className="text-sm text-slate-600">O que seus clientes podem agendar, com duração e preço.</p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              createService.reset();
              setCreating(true);
            }}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Novo serviço
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Novo serviço</h2>
          <ServiceForm
            submitLabel="Criar serviço"
            saving={createService.isPending}
            error={createService.error}
            onSubmit={(input) => createService.mutate(input, { onSuccess: () => setCreating(false) })}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      {updateService.error && <Alert>{updateService.error.message}</Alert>}

      {services.isPending ? (
        <Spinner />
      ) : services.isError ? (
        <Alert>{services.error.message}</Alert>
      ) : services.data.length === 0 ? (
        <Alert tone="info">Nenhum serviço ainda. Crie o primeiro para começar a receber agendamentos.</Alert>
      ) : (
        <ul className="space-y-2">
          {services.data.map((service) => (
            <li key={service.id}>
              {editingId === service.id ? (
                <Card>
                  <ServiceForm
                    initial={service}
                    submitLabel="Salvar"
                    saving={updateService.isPending}
                    error={updateService.error}
                    onSubmit={(input) =>
                      updateService.mutate({ id: service.id, ...input }, { onSuccess: () => setEditingId(null) })
                    }
                    onCancel={() => setEditingId(null)}
                  />
                </Card>
              ) : (
                <ServiceRow
                  service={service}
                  busy={updateService.isPending && updateService.variables?.id === service.id}
                  onEdit={() => {
                    updateService.reset();
                    setEditingId(service.id);
                  }}
                  onToggleActive={() => updateService.mutate({ id: service.id, active: !service.active })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  busy,
  onEdit,
  onToggleActive,
}: {
  service: Service;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <article
      aria-label={service.name}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 ${service.active ? "" : "opacity-60"}`}
    >
      <div>
        <p className="font-semibold text-slate-900">
          {service.name}
          {!service.active && <span className="ml-2 text-xs font-medium text-slate-500">(inativo)</span>}
        </p>
        <p className="text-sm text-slate-600">
          {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700">
          Editar
        </button>
        {/* Desativar em vez de apagar: o histórico de agendamentos continua apontando para o serviço. */}
        <button
          type="button"
          disabled={busy}
          onClick={onToggleActive}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-60"
        >
          {service.active ? "Desativar" : "Ativar"}
        </button>
      </div>
    </article>
  );
}
