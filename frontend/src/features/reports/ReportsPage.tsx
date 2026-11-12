import { useState } from "react";
import { TextField } from "../../components/form.tsx";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { formatLongDate, formatPrice, formatShortDate, localToday } from "../../lib/format.ts";
import { useAuthenticatedSession } from "../auth/api.ts";
import { type ReportSummary, useReportSummary } from "./api.ts";
import { type PeriodPreset, percentChange, presetRange } from "./math.ts";
import { RevenueChart } from "./RevenueChart.tsx";

const PRESETS: { value: PeriodPreset | "custom"; label: string }[] = [
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function ReportsPage() {
  const { timezone } = useAuthenticatedSession().establishment;
  const today = localToday(timezone);
  const [preset, setPreset] = useState<PeriodPreset | "custom">("month");
  const [custom, setCustom] = useState(() => presetRange("month", today));

  const range = preset === "custom" ? custom : presetRange(preset, today);
  const customInvalid = preset === "custom" && (!custom.from || !custom.to || custom.from > custom.to);
  const report = useReportSummary(customInvalid ? presetRange("month", today) : range);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-600">
          Receita = atendimentos <strong>concluídos</strong>, pelo preço cobrado em cada um.
        </p>
      </div>

      {/* Filtros numa linha só, acima dos números */}
      <div className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Período" className="flex flex-wrap rounded-lg border border-slate-300 bg-white p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={preset === p.value}
              onClick={() => setPreset(p.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${preset === p.value ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-2">
            <TextField label="De" name="report-from" type="date" value={custom.from} onChange={(from) => setCustom({ ...custom, from })} />
            <TextField label="Até" name="report-to" type="date" value={custom.to} onChange={(to) => setCustom({ ...custom, to })} />
          </div>
        )}
      </div>

      {customInvalid && <Alert>A data final precisa ser igual ou depois da inicial.</Alert>}

      {report.isPending ? (
        <Spinner label="Calculando" />
      ) : report.isError ? (
        <Alert>{report.error.message}</Alert>
      ) : (
        <Report data={report.data} />
      )}
    </div>
  );
}

function Report({ data }: { data: ReportSummary }) {
  const { totals, previous } = data;
  const comparedTo = `vs ${formatShortDate(previous.from)} a ${formatShortDate(previous.to)}`;

  return (
    <>
      <p className="text-sm text-slate-500">
        {formatLongDate(data.from)} até {formatLongDate(data.to)}
      </p>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Receita"
          value={formatPrice(totals.revenueCents)}
          change={percentChange(totals.revenueCents, previous.revenueCents)}
          comparedTo={comparedTo}
        />
        <StatTile
          label="Atendimentos concluídos"
          value={String(totals.completed)}
          change={percentChange(totals.completed, previous.completed)}
          comparedTo={comparedTo}
        />
        <StatTile label="Ticket médio" value={formatPrice(totals.averageTicketCents)} />
        <StatTile
          label="Taxa de faltas"
          value={totals.noShowRate === null ? "–" : percent.format(totals.noShowRate)}
          detail={`${totals.noShows} falta(s) · ${totals.canceled} cancelado(s)`}
        />
      </dl>

      {totals.scheduled > 0 && (
        <p className="text-sm text-slate-500">
          {totals.scheduled} agendamento(s) do período ainda sem resultado (futuros ou não marcados na agenda) não entram na receita.
        </p>
      )}

      <Card>
        {totals.revenueCents === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma receita neste período.</p>
        ) : (
          <RevenueChart days={data.byDay} />
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Ranking
          title="Por serviço"
          rows={data.byService.map((s) => ({ id: s.id, name: s.name, revenueCents: s.revenueCents, detail: `${s.completed} atendimento(s)` }))}
        />
        <Ranking
          title="Por profissional"
          rows={data.byProfessional.map((p) => ({
            id: p.id,
            name: p.name,
            revenueCents: p.revenueCents,
            detail: `${p.completed} atendimento(s) · ${p.noShows} falta(s)`,
          }))}
        />
      </div>
    </>
  );
}

// Cartão de número principal: rótulo, valor e (opcional) variação vs o período anterior.
// A variação usa seta + sinal + texto, não só cor (quem não distingue verde/vermelho também entende).
function StatTile({
  label,
  value,
  change,
  comparedTo,
  detail,
}: {
  label: string;
  value: string;
  change?: number | null;
  comparedTo?: string;
  detail?: string;
}) {
  return (
    <Card className="p-4!">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
      {change !== undefined && (
        <dd className="mt-1 text-xs text-slate-500">
          {change === null ? (
            "Sem dados no período anterior"
          ) : (
            <>
              <span className={change >= 0 ? "font-medium text-emerald-700" : "font-medium text-red-700"}>
                {change >= 0 ? "▲" : "▼"} {change >= 0 ? "+" : ""}
                {percent.format(change)}
              </span>{" "}
              {comparedTo}
            </>
          )}
        </dd>
      )}
      {detail && <dd className="mt-1 text-xs text-slate-500">{detail}</dd>}
    </Card>
  );
}

// Ranking com barra de proporção (uma cor só, o tamanho é o que importa). O texto fica nas cores de texto.
function Ranking({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; name: string; revenueCents: number; detail: string }[];
}) {
  const top = rows[0]?.revenueCents ?? 0;
  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum atendimento concluído no período.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} aria-label={`${row.name}: ${formatPrice(row.revenueCents)}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-900">{row.name}</span>
                <span className="font-semibold text-slate-900">{formatPrice(row.revenueCents)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-teal-600" style={{ width: `${top ? (row.revenueCents / top) * 100 : 0}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{row.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
