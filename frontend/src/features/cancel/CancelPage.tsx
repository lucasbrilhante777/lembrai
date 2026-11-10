import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Alert, Card, PrimaryButton, Spinner } from "../../components/ui.tsx";
import { ApiError, api } from "../../lib/api.ts";
import { formatLongDate } from "../../lib/format.ts";
import { useNow } from "../../lib/use-now.ts";

// Página do link "Cancelar" do e-mail (/cancelar/:token).
// Abrir a página NÃO cancela (GET só mostra): leitores de e-mail abrem links sozinhos para checar segurança.
// O cancelamento só acontece no clique do botão (POST).

type AppointmentSummary = {
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  startAt: string;
  date: string;
  time: string;
  establishment: { name: string; slug: string };
  service: { name: string };
  professional: { name: string };
};

export function CancelPage() {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();
  const queryKey = ["appointment-by-token", token];

  const appointment = useQuery({
    queryKey,
    queryFn: () => api<AppointmentSummary>(`/public/appointments/${token}`),
  });
  const cancel = useMutation({
    mutationFn: () => api<AppointmentSummary>(`/public/appointments/${token}/cancel`, { method: "POST" }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-6 text-sm font-semibold text-teal-700">Lembrai</p>
      {appointment.isPending ? (
        <Spinner />
      ) : appointment.isError ? (
        <Alert>
          {appointment.error instanceof ApiError && appointment.error.status === 404
            ? "Não encontramos esse agendamento. Confira se o link do e-mail está completo."
            : appointment.error.message}
        </Alert>
      ) : (
        <Content
          appointment={appointment.data}
          cancelling={cancel.isPending}
          cancelError={cancel.error?.message ?? null}
          onCancel={() => cancel.mutate()}
        />
      )}
    </main>
  );
}

function Content({
  appointment,
  cancelling,
  cancelError,
  onCancel,
}: {
  appointment: AppointmentSummary;
  cancelling: boolean;
  cancelError: string | null;
  onCancel: () => void;
}) {
  const now = useNow();
  const canCancel = appointment.status === "SCHEDULED" && new Date(appointment.startAt) > now;
  const bookAgain = `/agenda/${appointment.establishment.slug}`;

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">
        {appointment.status === "CANCELED" ? "Agendamento cancelado" : "Cancelar agendamento"}
      </h1>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <dt className="text-slate-500">Quando</dt>
        <dd className="font-medium">
          {formatLongDate(appointment.date)} às {appointment.time}
        </dd>
        <dt className="text-slate-500">Serviço</dt>
        <dd className="font-medium">{appointment.service.name}</dd>
        <dt className="text-slate-500">Com</dt>
        <dd className="font-medium">{appointment.professional.name}</dd>
        <dt className="text-slate-500">Onde</dt>
        <dd className="font-medium">{appointment.establishment.name}</dd>
      </dl>

      {cancelError && <Alert>{cancelError}</Alert>}

      {appointment.status === "CANCELED" ? (
        <>
          <Alert tone="info">Este horário foi cancelado e está livre para outra pessoa.</Alert>
          <Link to={bookAgain} className="block text-center font-medium text-teal-700 hover:underline">
            Marcar outro horário
          </Link>
        </>
      ) : canCancel ? (
        <>
          <p className="text-sm text-slate-600">Não vai conseguir ir? Cancelando, o horário fica livre para outra pessoa.</p>
          <PrimaryButton onClick={onCancel} disabled={cancelling} variant="danger">
            {cancelling ? "Cancelando..." : "Cancelar agendamento"}
          </PrimaryButton>
        </>
      ) : (
        <Alert tone="info">Este agendamento não pode mais ser cancelado.</Alert>
      )}
    </Card>
  );
}
