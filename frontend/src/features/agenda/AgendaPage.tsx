import { useState } from "react";
import { Link } from "react-router";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { addDays, formatLongDate, formatPrice, formatWeekRange, localToday, startOfWeek } from "../../lib/format.ts";
import { useNow } from "../../lib/use-now.ts";
import { useAuthenticatedSession } from "../auth/api.ts";
import { useProfessionals } from "../professionals/api.ts";
import { useServices } from "../services/api.ts";
import { type Appointment, type OwnerTargetStatus, useAppointments, useUpdateStatus } from "./api.ts";
import { AppointmentCard } from "./AppointmentCard.tsx";
import { type TimeOff, timeOffsOnDay, useTimeOffs } from "../time-offs/api.ts";
import { describePeriod, describeWho } from "../time-offs/describe.ts";

type View = "day" | "week";

export function AgendaPage() {
  const { timezone } = useAuthenticatedSession().establishment;
  const now = useNow();
  const today = localToday(timezone, now);

  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(today); // dia de referência (no modo semana, qualquer dia dela)
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  // O período consultado, em datas LOCAIS do estabelecimento (a API converte para UTC).
  const from = view === "day" ? anchor : startOfWeek(anchor);
  const to = view === "day" ? anchor : addDays(from, 6);

  const agenda = useAppointments({ from, to, professionalId });
  const timeOffs = useTimeOffs({ from, to });
  // Com filtro de profissional: só os bloqueios dele e os do estabelecimento inteiro.
  const visibleTimeOffs = (timeOffs.data ?? []).filter((t) => !professionalId || !t.professional || t.professional.id === professionalId);
  const professionals = useProfessionals();
  const services = useServices();
  const updateStatus = useUpdateStatus();
  const statusError = updateStatus.error instanceof ApiError ? updateStatus.error.message : null;

  const step = view === "day" ? 1 : 7;
  const title = view === "day" ? formatLongDate(anchor) : formatWeekRange(from, to);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-600">{title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Visualização" className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {v === "day" ? "Dia" : "Semana"}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-slate-300 bg-white">
            <NavButton label={view === "day" ? "Dia anterior" : "Semana anterior"} onClick={() => setAnchor(addDays(anchor, -step))}>
              ‹
            </NavButton>
            <button
              type="button"
              onClick={() => setAnchor(today)}
              className="border-x border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Hoje
            </button>
            <NavButton label={view === "day" ? "Próximo dia" : "Próxima semana"} onClick={() => setAnchor(addDays(anchor, step))}>
              ›
            </NavButton>
          </div>
          <label className="sr-only" htmlFor="filter-professional">
            Profissional
          </label>
          <select
            id="filter-professional"
            value={professionalId ?? ""}
            onChange={(e) => setProfessionalId(e.target.value || null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos os profissionais</option>
            {professionals.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.active ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {services.data && professionals.data && (
        <GettingStarted
          hasServices={services.data.some((s) => s.active)}
          hasReadyProfessional={professionals.data.some(
            (p) => p.active && p.serviceIds.length > 0 && p.workingHours.length > 0,
          )}
        />
      )}

      {statusError && <Alert>{statusError}</Alert>}

      {agenda.isPending ? (
        <Spinner label="Carregando agenda" />
      ) : agenda.isError ? (
        <Alert>{agenda.error.message}</Alert>
      ) : (
        <>
          <Summary appointments={agenda.data.appointments} />
          {view === "day" ? (
            <div className="space-y-2">
              <DayBlocks timeOffs={timeOffsOnDay(visibleTimeOffs, anchor)} />
              <DayList
                now={now}
                appointments={agenda.data.appointments}
                busyId={updateStatus.isPending ? updateStatus.variables?.id : undefined}
                onChangeStatus={(id, status) => updateStatus.mutate({ id, status })}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((day) => (
                <section key={day} aria-label={formatLongDate(day)}>
                  <h2 className={`mb-2 text-sm font-semibold ${day === today ? "text-teal-700" : "text-slate-700"}`}>
                    {formatLongDate(day)}
                    {day === today && " (hoje)"}
                  </h2>
                  <DayBlocks timeOffs={timeOffsOnDay(visibleTimeOffs, day)} />
                  <DayList
                    now={now}
                    appointments={agenda.data.appointments.filter((a) => a.date === day)}
                    busyId={updateStatus.isPending ? updateStatus.variables?.id : undefined}
                    onChangeStatus={(id, status) => updateStatus.mutate({ id, status })}
                  />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DayList({
  appointments,
  now,
  busyId,
  onChangeStatus,
}: {
  appointments: Appointment[];
  now: Date;
  busyId: string | undefined;
  onChangeStatus: (id: string, status: OwnerTargetStatus) => void;
}) {
  if (appointments.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhum agendamento.</p>;
  }
  return (
    <div className="space-y-2">
      {appointments.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          now={now}
          busy={busyId === appointment.id}
          onChangeStatus={(status) => onChangeStatus(appointment.id, status)}
        />
      ))}
    </div>
  );
}

// Números do período mostrado. "Receita" soma só os concluídos, pelo preço salvo em cada agendamento.
function Summary({ appointments }: { appointments: Appointment[] }) {
  const active = appointments.filter((a) => a.status !== "CANCELED");
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const noShow = appointments.filter((a) => a.status === "NO_SHOW");
  const revenue = completed.reduce((sum, a) => sum + a.priceCents, 0);

  const items = [
    { label: "Agendamentos", value: String(active.length) },
    { label: "Concluídos", value: String(completed.length) },
    { label: "Faltas", value: String(noShow.length) },
    { label: "Receita (concluídos)", value: formatPrice(revenue) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4!">
          <dt className="text-xs text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{item.value}</dd>
        </Card>
      ))}
    </dl>
  );
}

// Faixa "Bloqueado" no topo do dia: o dono vê na agenda por que não há horários (folga, feriado...).
function DayBlocks({ timeOffs }: { timeOffs: TimeOff[] }) {
  if (timeOffs.length === 0) return null;
  return (
    <ul className="mb-2 space-y-1">
      {timeOffs.map((t) => (
        <li key={t.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          🚫 <strong>Bloqueado</strong>: {describeWho(t)}, {t.allDay ? "dia inteiro" : `${t.startTime}–${t.endTime}`}
          {t.reason && ` (${t.reason})`}
          {t.allDay && t.startDate !== t.endDate && <span className="text-amber-700"> · {describePeriod(t)}</span>}
        </li>
      ))}
    </ul>
  );
}

// Conta nova: mostra o que falta para a página pública começar a ter horários. Some quando estiver tudo pronto.
function GettingStarted({ hasServices, hasReadyProfessional }: { hasServices: boolean; hasReadyProfessional: boolean }) {
  if (hasServices && hasReadyProfessional) return null;
  return (
    <Card className="border-teal-200 bg-teal-50">
      <h2 className="font-semibold text-teal-900">Primeiros passos</h2>
      <p className="mt-1 text-sm text-teal-900">Para seus clientes conseguirem agendar:</p>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-teal-900">
        <li className={hasServices ? "line-through opacity-60" : ""}>
          Cadastre seus <Link to="/painel/servicos" className="font-medium underline">serviços</Link>
        </li>
        <li className={hasReadyProfessional ? "line-through opacity-60" : ""}>
          Cadastre um <Link to="/painel/profissionais" className="font-medium underline">profissional</Link>, com os serviços que
          ele faz e os horários de trabalho
        </li>
      </ol>
    </Card>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="px-3 py-1.5 text-lg leading-none text-slate-600 hover:bg-slate-100">
      {children}
    </button>
  );
}
