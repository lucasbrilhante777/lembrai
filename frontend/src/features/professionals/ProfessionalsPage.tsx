import { useState } from "react";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { useServices } from "../services/api.ts";
import {
  type Professional,
  useCreateProfessional,
  useProfessionals,
  useReplaceWorkingHours,
  useUpdateProfessional,
} from "./api.ts";
import { ProfessionalForm } from "./ProfessionalForm.tsx";
import { summarizeWeek } from "./schedule.ts";
import { WorkingHoursEditor } from "./WorkingHoursEditor.tsx";

// O que está aberto na tela: nada, o formulário de criação, a edição de um profissional ou os horários dele.
type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; id: string } | { kind: "hours"; id: string };

export function ProfessionalsPage() {
  const professionals = useProfessionals();
  const services = useServices();
  const create = useCreateProfessional();
  const update = useUpdateProfessional();
  const replaceHours = useReplaceWorkingHours();
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  function open(next: Mode) {
    create.reset();
    update.reset();
    replaceHours.reset();
    setMode(next);
  }
  const close = () => setMode({ kind: "list" });

  const serviceNames = new Map(services.data?.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Profissionais</h1>
          <p className="text-sm text-slate-600">Quem atende, quais serviços faz e em que horários.</p>
        </div>
        {mode.kind !== "create" && (
          <button
            type="button"
            onClick={() => open({ kind: "create" })}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Novo profissional
          </button>
        )}
      </div>

      {mode.kind === "create" && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Novo profissional</h2>
          <ProfessionalForm
            services={services.data ?? []}
            submitLabel="Criar profissional"
            saving={create.isPending}
            error={create.error}
            // Depois de criar, já abre os horários: sem expediente, ninguém consegue agendar com ele.
            onSubmit={(input) => create.mutate(input, { onSuccess: (created) => open({ kind: "hours", id: created.id }) })}
            onCancel={close}
          />
        </Card>
      )}

      {update.error && mode.kind === "list" && <Alert>{update.error.message}</Alert>}

      {professionals.isPending ? (
        <Spinner />
      ) : professionals.isError ? (
        <Alert>{professionals.error.message}</Alert>
      ) : professionals.data.length === 0 ? (
        <Alert tone="info">Nenhum profissional ainda. Cadastre quem atende para liberar os horários na sua página.</Alert>
      ) : (
        <ul className="space-y-2">
          {professionals.data.map((professional) => (
            <li key={professional.id}>
              {mode.kind === "edit" && mode.id === professional.id ? (
                <Card>
                  <ProfessionalForm
                    initial={professional}
                    services={services.data ?? []}
                    submitLabel="Salvar"
                    saving={update.isPending}
                    error={update.error}
                    onSubmit={(input) => update.mutate({ id: professional.id, ...input }, { onSuccess: close })}
                    onCancel={close}
                  />
                </Card>
              ) : mode.kind === "hours" && mode.id === professional.id ? (
                <Card>
                  <WorkingHoursEditor
                    professionalName={professional.name}
                    initial={professional.workingHours}
                    saving={replaceHours.isPending}
                    apiError={replaceHours.error?.message ?? null}
                    onSave={(workingHours) =>
                      replaceHours.mutate({ id: professional.id, workingHours }, { onSuccess: close })
                    }
                    onCancel={close}
                  />
                </Card>
              ) : (
                <ProfessionalRow
                  professional={professional}
                  serviceNames={serviceNames}
                  busy={update.isPending && update.variables?.id === professional.id}
                  onEdit={() => open({ kind: "edit", id: professional.id })}
                  onHours={() => open({ kind: "hours", id: professional.id })}
                  onToggleActive={() => update.mutate({ id: professional.id, active: !professional.active })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfessionalRow({
  professional,
  serviceNames,
  busy,
  onEdit,
  onHours,
  onToggleActive,
}: {
  professional: Professional;
  serviceNames: Map<string, string>;
  busy: boolean;
  onEdit: () => void;
  onHours: () => void;
  onToggleActive: () => void;
}) {
  const services = professional.serviceIds.map((id) => serviceNames.get(id)).filter(Boolean);
  const buttonClass =
    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-60";

  return (
    <article
      aria-label={professional.name}
      className={`space-y-2 rounded-xl border border-slate-200 bg-white p-4 ${professional.active ? "" : "opacity-60"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">
            {professional.name}
            {!professional.active && <span className="ml-2 text-xs font-medium text-slate-500">(inativo)</span>}
          </p>
          <p className="text-sm text-slate-600">{services.length > 0 ? services.join(", ") : "Nenhum serviço vinculado"}</p>
          <p className="text-sm text-slate-500">{summarizeWeek(professional.workingHours)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className={buttonClass}>
            Editar
          </button>
          <button type="button" onClick={onHours} className={buttonClass}>
            Horários
          </button>
          <button type="button" disabled={busy} onClick={onToggleActive} className={buttonClass}>
            {professional.active ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>
    </article>
  );
}
