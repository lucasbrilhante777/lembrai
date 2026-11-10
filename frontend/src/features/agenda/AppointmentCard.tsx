import { useState } from "react";
import { formatPrice } from "../../lib/format.ts";
import type { Appointment, OwnerTargetStatus } from "./api.ts";
import { STATUS_LABEL, STATUS_STYLE, availableActions } from "./status.ts";

type Props = {
  appointment: Appointment;
  now: Date;
  busy: boolean;
  onChangeStatus: (status: OwnerTargetStatus) => void;
};

export function AppointmentCard({ appointment, now, busy, onChangeStatus }: Props) {
  // Ação que pede confirmação (cancelar) aguardando o "sim".
  const [pendingConfirm, setPendingConfirm] = useState<OwnerTargetStatus | null>(null);
  const actions = availableActions(appointment, now);
  const canceled = appointment.status === "CANCELED";
  const confirming = actions.find((a) => a.status === pendingConfirm);

  return (
    <article
      aria-label={`${appointment.time} ${appointment.customer.name}`}
      className={`rounded-xl border bg-white p-4 ${canceled ? "border-slate-200 opacity-70" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">
            {appointment.time}–{appointment.endTime}{" "}
            <span className={canceled ? "line-through" : ""}>{appointment.customer.name}</span>
          </p>
          <p className="text-sm text-slate-600">
            {appointment.service.name} · {appointment.professional.name} · {formatPrice(appointment.priceCents)}
          </p>
          <p className="mt-1 text-sm">
            <a href={`tel:${appointment.customer.phone}`} className="text-teal-700 hover:underline">
              {formatPhone(appointment.customer.phone)}
            </a>
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLE[appointment.status]}`}>
          {STATUS_LABEL[appointment.status]}
        </span>
      </div>

      {confirming ? (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alertdialog" aria-label="Confirmar">
          <p>{confirming.confirm}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onChangeStatus(confirming.status);
                setPendingConfirm(null);
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Sim, cancelar
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              className="rounded-lg px-3 py-1.5 font-medium text-red-800 hover:bg-red-100"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={busy}
                onClick={() => (action.confirm ? setPendingConfirm(action.status) : onChangeStatus(action.status))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
          </div>
        )
      )}
    </article>
  );
}

/** "81999999999" -> "(81) 99999-9999" */
function formatPhone(digits: string) {
  const local = digits.length > 11 ? digits.slice(-11) : digits;
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(local);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}
