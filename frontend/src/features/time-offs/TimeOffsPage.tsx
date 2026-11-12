import { type FormEvent, useState } from "react";
import { TextField } from "../../components/form.tsx";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { formatLongDate, localToday } from "../../lib/format.ts";
import { useAuthenticatedSession } from "../auth/api.ts";
import { useProfessionals } from "../professionals/api.ts";
import { type CreateTimeOffInput, type TimeOffConflict, useCreateTimeOff, useDeleteTimeOff, useTimeOffs } from "./api.ts";
import { describePeriod, describeWho } from "./describe.ts";

type Kind = "days" | "hours";

export function TimeOffsPage() {
  const { timezone } = useAuthenticatedSession().establishment;
  const today = localToday(timezone);
  const timeOffs = useTimeOffs();
  const professionals = useProfessionals();
  const create = useCreateTimeOff();
  const remove = useDeleteTimeOff();

  // Formulário
  const [professionalId, setProfessionalId] = useState(""); // "" = estabelecimento inteiro
  const [kind, setKind] = useState<Kind>("days");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("14:00");
  const [reason, setReason] = useState("");
  // Agendamentos que já existiam no período do último bloqueio criado
  const [conflicts, setConflicts] = useState<TimeOffConflict[] | null>(null);

  const apiError = create.error instanceof ApiError ? create.error : null;
  const errorFor = (path: string) => apiError?.issues.find((i) => i.path === path)?.message;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const base = { professionalId: professionalId || null, reason: reason || undefined };
    const body: CreateTimeOffInput =
      kind === "days" ? { kind, ...base, startDate, endDate } : { kind, ...base, date: startDate, startTime, endTime };
    create.mutate(body, {
      onSuccess: (result) => {
        setConflicts(result.conflicts);
        setReason("");
      },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Bloqueios</h1>
        <p className="text-sm text-slate-600">
          Folgas, férias, feriados e compromissos. Os horários bloqueados somem da sua página de agendamento.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">Novo bloqueio</h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {apiError && apiError.issues.length === 0 && <Alert>{apiError.message}</Alert>}

          <div>
            <label htmlFor="field-who" className="mb-1 block text-sm font-medium text-slate-700">
              Quem fica bloqueado
            </label>
            <select
              id="field-who"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
            >
              <option value="">Todos os profissionais (ex.: feriado)</option>
              {professionals.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Período</legend>
            <div className="flex gap-2">
              {(["days", "hours"] as const).map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm has-checked:border-teal-600 has-checked:bg-teal-50"
                >
                  <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="accent-teal-600" />
                  {k === "days" ? "Dias inteiros" : "Algumas horas"}
                </label>
              ))}
            </div>
          </fieldset>

          {kind === "days" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="De" name="startDate" type="date" value={startDate} onChange={setStartDate} error={errorFor("startDate")} />
              <TextField label="Até (inclusive)" name="endDate" type="date" value={endDate} onChange={setEndDate} error={errorFor("endDate")} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="Dia" name="date" type="date" value={startDate} onChange={setStartDate} error={errorFor("date")} />
              <TextField label="Das" name="startTime" type="time" value={startTime} onChange={setStartTime} error={errorFor("startTime")} />
              <TextField label="Até" name="endTime" type="time" value={endTime} onChange={setEndTime} error={errorFor("endTime")} />
            </div>
          )}

          <TextField
            label="Motivo (opcional)"
            name="reason"
            placeholder="Ex.: Feriado, férias, consulta médica"
            value={reason}
            onChange={setReason}
            error={errorFor("reason")}
          />

          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {create.isPending ? "Bloqueando..." : "Bloquear"}
          </button>
        </form>
      </Card>

      {conflicts !== null && (
        <Alert tone={conflicts.length > 0 ? "error" : "info"}>
          {conflicts.length === 0 ? (
            "Bloqueio criado. Não havia agendamentos nesse período."
          ) : (
            <>
              <p className="font-medium">
                Bloqueio criado, mas {conflicts.length === 1 ? "já existe 1 agendamento" : `já existem ${conflicts.length} agendamentos`}{" "}
                nesse período. Eles continuam marcados: cancele-os na agenda se precisar (o cliente é avisado por e-mail).
              </p>
              <ul className="mt-2 list-inside list-disc">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {formatLongDate(c.date)} às {c.time}: {c.customer} ({c.professional})
                  </li>
                ))}
              </ul>
            </>
          )}
        </Alert>
      )}

      {remove.error && <Alert>{remove.error.message}</Alert>}

      <section aria-labelledby="upcoming-title" className="space-y-2">
        <h2 id="upcoming-title" className="font-semibold text-slate-900">
          Bloqueios atuais e futuros
        </h2>
        {timeOffs.isPending ? (
          <Spinner />
        ) : timeOffs.isError ? (
          <Alert>{timeOffs.error.message}</Alert>
        ) : timeOffs.data.length === 0 ? (
          <Alert tone="info">Nenhum bloqueio.</Alert>
        ) : (
          <ul className="space-y-2">
            {timeOffs.data.map((timeOff) => (
              <li key={timeOff.id}>
                <article
                  aria-label={`${describeWho(timeOff)}: ${describePeriod(timeOff)}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{describePeriod(timeOff)}</p>
                    <p className="text-sm text-slate-600">
                      {describeWho(timeOff)}
                      {timeOff.reason && ` · ${timeOff.reason}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={remove.isPending && remove.variables === timeOff.id}
                    onClick={() => remove.mutate(timeOff.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-red-400 hover:text-red-700 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
