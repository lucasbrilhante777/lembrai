import { Card, PrimaryButton } from "../../components/ui.tsx";
import { formatLongDate, formatPrice } from "../../lib/format.ts";
import type { BookingResult } from "./api.ts";

export function BookingSuccess({
  booking,
  email,
  onNewBooking,
}: {
  booking: BookingResult;
  email: string;
  onNewBooking: () => void;
}) {
  return (
    <Card className="space-y-5 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal-100 text-2xl text-teal-700">
        ✓
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Agendamento confirmado!</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enviamos a confirmação para <strong>{email}</strong>. Você também vai receber um lembrete 24 horas antes.
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
        <dt className="text-slate-500">Quando</dt>
        <dd className="font-medium">
          {formatLongDate(booking.date)} às {booking.time}
        </dd>
        <dt className="text-slate-500">Serviço</dt>
        <dd className="font-medium">
          {booking.service.name} ({formatPrice(booking.priceCents)})
        </dd>
        <dt className="text-slate-500">Com</dt>
        <dd className="font-medium">{booking.professional.name}</dd>
        <dt className="text-slate-500">Onde</dt>
        <dd className="font-medium">{booking.establishment.name}</dd>
      </dl>

      <p className="text-xs text-slate-500">Precisa cancelar? Use o link que está no e-mail.</p>

      <PrimaryButton onClick={onNewBooking}>Fazer outro agendamento</PrimaryButton>
    </Card>
  );
}
