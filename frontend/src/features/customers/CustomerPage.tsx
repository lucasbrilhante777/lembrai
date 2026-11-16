import { Link, useParams } from "react-router";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { formatInstantDate, formatInstantDateTime, formatLongDate, formatPhone, formatPrice } from "../../lib/format.ts";
import { STATUS_LABEL, STATUS_STYLE } from "../agenda/status.ts";
import { useAuthenticatedSession } from "../auth/api.ts";
import { useCustomer } from "./api.ts";

// Ficha do cliente: contato, números e o histórico completo (mais recente primeiro).
export function CustomerPage() {
  const { id = "" } = useParams();
  const { timezone } = useAuthenticatedSession().establishment;
  const customer = useCustomer(id);

  return (
    <div className="space-y-5">
      <Link to="/painel/clientes" className="text-sm font-medium text-teal-700 hover:underline">
        ← Clientes
      </Link>

      {customer.isPending ? (
        <Spinner />
      ) : customer.isError ? (
        <Alert>
          {customer.error instanceof ApiError && customer.error.status === 404 ? "Cliente não encontrado." : customer.error.message}
        </Alert>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{customer.data.name}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
              <a href={`tel:${customer.data.phone}`} className="text-teal-700 hover:underline">
                {formatPhone(customer.data.phone)}
              </a>
              <a href={`mailto:${customer.data.email}`} className="text-teal-700 hover:underline">
                {customer.data.email}
              </a>
              <span className="text-slate-500">Cliente desde {formatInstantDate(customer.data.createdAt, timezone)}</span>
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Visitas" value={String(customer.data.completed)} />
            <Tile label="Faltas" value={String(customer.data.noShows)} detail={`${customer.data.canceled} cancelado(s)`} />
            <Tile label="Total gasto" value={formatPrice(customer.data.totalSpentCents)} />
            <Tile label="Ticket médio" value={formatPrice(customer.data.averageTicketCents)} />
          </dl>

          {customer.data.nextAppointmentAt && (
            <Alert tone="info">Próximo horário marcado: {formatInstantDateTime(customer.data.nextAppointmentAt, timezone)}.</Alert>
          )}

          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">Histórico</h2>
            {customer.data.appointments.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum agendamento.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.data.appointments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {formatLongDate(a.date)} às {a.time}
                      </p>
                      <p className="text-slate-600">
                        {a.service} · {a.professional} · {formatPrice(a.priceCents)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="p-4!">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
      {detail && <dd className="mt-1 text-xs text-slate-500">{detail}</dd>}
    </Card>
  );
}
