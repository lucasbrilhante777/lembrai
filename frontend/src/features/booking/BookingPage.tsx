import { type ReactNode, useMemo, useState } from "react";
import { useParams } from "react-router";
import { TextField } from "../../components/form.tsx";
import { Alert, Card, OptionButton, Spinner, Step } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { addDays, formatDayChip, formatDuration, formatLongDate, formatPrice, localToday } from "../../lib/format.ts";
import {
  type BookingResult,
  type CustomerInput,
  type Slot,
  useAvailability,
  useCreateAppointment,
  useEstablishment,
} from "./api.ts";
import { BookingSuccess } from "./BookingSuccess.tsx";
import { CustomerForm } from "./CustomerForm.tsx";

/** Quantos dias aparecem para escolher (a API aceita até 60). */
const DAYS_TO_SHOW = 14;

// Página pública /agenda/:slug. O cliente escolhe, em ordem: serviço -> profissional -> dia -> horário -> dados.
// Cada passo só aparece depois do anterior, e trocar uma escolha limpa as que dependem dela.
export function BookingPage() {
  const { slug = "" } = useParams();
  const establishment = useEstablishment(slug);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [customer, setCustomer] = useState<CustomerInput>({ name: "", email: "", phone: "" });
  const [consent, setConsent] = useState(false);
  // "Para outra pessoa": só entra em cena quando a API avisa que esse e-mail já tem horário nesse período.
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [attendeeName, setAttendeeName] = useState("");
  const [booking, setBooking] = useState<{ result: BookingResult; email: string } | null>(null);

  const availability = useAvailability(
    slug,
    serviceId && professionalId && date ? { serviceId, professionalId, date } : null,
  );
  const createAppointment = useCreateAppointment(slug);

  const data = establishment.data;
  const professionals = useMemo(
    () => data?.professionals.filter((p) => serviceId && p.serviceIds.includes(serviceId)) ?? [],
    [data, serviceId],
  );
  const dates = useMemo(() => {
    if (!data) return [];
    const today = localToday(data.timezone);
    return Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(today, i));
  }, [data]);

  if (establishment.isPending) {
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  }

  if (establishment.isError || !data) {
    const notFound = establishment.error instanceof ApiError && establishment.error.status === 404;
    return (
      <Layout>
        <Alert>{notFound ? "Não encontramos esse estabelecimento. Confira o link." : establishment.error?.message}</Alert>
      </Layout>
    );
  }

  if (booking) {
    return (
      <Layout title={data.name}>
        <BookingSuccess
          booking={booking.result}
          email={booking.email}
          onNewBooking={() => {
            setBooking(null);
            setSlot(null);
            setForSomeoneElse(false);
            setAttendeeName("");
            createAppointment.reset();
          }}
        />
      </Layout>
    );
  }

  const selectedService = data.services.find((s) => s.id === serviceId);
  const apiError = createAppointment.error instanceof ApiError ? createAppointment.error : null;
  // Cada 409 tem um código (ver BOOKING_ERRORS no backend) e uma reação diferente na tela:
  // SLOT_TAKEN = o horário foi ocupado enquanto o cliente preenchia -> escolher outro horário.
  const conflictMessage = apiError?.code === "SLOT_TAKEN" ? apiError.message : null;
  // CUSTOMER_TIME_CONFLICT = esse e-mail já tem horário nesse período -> perguntar se é para outra pessoa.
  const askForSomeoneElse = apiError?.code === "CUSTOMER_TIME_CONFLICT" && !forSomeoneElse;
  const otherError = apiError && !conflictMessage && apiError.code !== "CUSTOMER_TIME_CONFLICT" && apiError.issues.length === 0;

  function submit() {
    createAppointment.mutate(
      {
        serviceId: serviceId!,
        professionalId: professionalId!,
        startAt: slot!.startAt,
        customer,
        consent,
        ...(forSomeoneElse ? { attendeeName } : {}),
      },
      {
        onSuccess: (result) => setBooking({ result, email: customer.email.trim().toLowerCase() }),
        onError: (error) => {
          // Desmarca o horário perdido; a lista de horários é recarregada (ver useCreateAppointment).
          if (error instanceof ApiError && error.code === "SLOT_TAKEN") setSlot(null);
        },
      },
    );
  }

  function chooseService(id: string) {
    setServiceId(id);
    // Mantém o profissional só se ele também fizer o novo serviço.
    if (!data?.professionals.find((p) => p.id === professionalId)?.serviceIds.includes(id)) setProfessionalId(null);
    setSlot(null);
    createAppointment.reset();
  }

  return (
    <Layout title={data.name}>
      <Card className="space-y-8">
        <Step number={1} title="Escolha o serviço">
          {data.services.length === 0 ? (
            <Alert tone="info">Este estabelecimento ainda não tem serviços disponíveis.</Alert>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.services.map((service) => (
                <OptionButton
                  key={service.id}
                  selected={service.id === serviceId}
                  onClick={() => chooseService(service.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-medium text-slate-900">{service.name}</span>
                    <span className="text-sm text-slate-500">{formatDuration(service.durationMinutes)}</span>
                  </span>
                  <span className="font-semibold text-teal-700">{formatPrice(service.priceCents)}</span>
                </OptionButton>
              ))}
            </div>
          )}
        </Step>

        {serviceId && (
          <Step number={2} title="Com quem?">
            {professionals.length === 0 ? (
              <Alert tone="info">Nenhum profissional faz esse serviço no momento.</Alert>
            ) : (
              <div className="flex flex-wrap gap-2">
                {professionals.map((professional) => (
                  <OptionButton
                    key={professional.id}
                    selected={professional.id === professionalId}
                    onClick={() => {
                      setProfessionalId(professional.id);
                      setSlot(null);
                      createAppointment.reset();
                    }}
                    className="px-4 py-2.5 font-medium"
                  >
                    {professional.name}
                  </OptionButton>
                ))}
              </div>
            )}
          </Step>
        )}

        {serviceId && professionalId && (
          <Step number={3} title="Escolha o dia">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              {dates.map((d) => {
                const chip = formatDayChip(d);
                return (
                  <OptionButton
                    key={d}
                    selected={d === date}
                    onClick={() => {
                      setDate(d);
                      setSlot(null);
                      createAppointment.reset();
                    }}
                    aria-label={formatLongDate(d)}
                    className="flex min-w-16 shrink-0 flex-col items-center px-3 py-2 text-center"
                  >
                    <span className="text-xs uppercase text-slate-500">{chip.weekday.replace(".", "")}</span>
                    <span className="font-semibold text-slate-900">{chip.day}</span>
                  </OptionButton>
                );
              })}
            </div>
          </Step>
        )}

        {serviceId && professionalId && date && (
          <Step number={4} title="Escolha o horário">
            {conflictMessage && <Alert>{conflictMessage}</Alert>}
            {availability.isPending ? (
              <Spinner label="Buscando horários" />
            ) : availability.isError ? (
              <Alert>{availability.error.message}</Alert>
            ) : availability.data.slots.length === 0 ? (
              <Alert tone="info">Nenhum horário livre neste dia. Tente outro dia.</Alert>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {availability.data.slots.map((s) => (
                  <OptionButton
                    key={s.startAt}
                    selected={s.startAt === slot?.startAt}
                    onClick={() => {
                      setSlot(s);
                      createAppointment.reset();
                    }}
                    className="py-2 text-center font-medium"
                  >
                    {s.time}
                  </OptionButton>
                ))}
              </div>
            )}
          </Step>
        )}

        {slot && selectedService && (
          <Step number={5} title="Seus dados">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{selectedService.name}</strong> em {formatLongDate(date!)} às{" "}
              <strong className="text-slate-900">{slot.time}</strong>
            </p>

            {/* Outros erros sem campo específico (ex.: limite de agendamentos, falha de conexão). */}
            {otherError && <Alert>{apiError.message}</Alert>}

            {askForSomeoneElse && (
              <div role="alertdialog" aria-label="Horário no mesmo período" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p>{apiError.message}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForSomeoneElse(true);
                      createAppointment.reset();
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
                  >
                    Sim, é para outra pessoa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSlot(null);
                      createAppointment.reset();
                    }}
                    className="rounded-lg px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Não, vou escolher outro horário
                  </button>
                </div>
              </div>
            )}

            {forSomeoneElse && (
              <div className="space-y-1">
                <TextField
                  label="Nome de quem vai ser atendido"
                  name="attendeeName"
                  hint="O contato (e-mail e lembrete) continua sendo você."
                  value={attendeeName}
                  onChange={setAttendeeName}
                  error={apiError?.issues.find((i) => i.path === "attendeeName")?.message}
                />
                <button
                  type="button"
                  onClick={() => {
                    setForSomeoneElse(false);
                    setAttendeeName("");
                  }}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  Não é para outra pessoa
                </button>
              </div>
            )}

            <CustomerForm
              customer={customer}
              consent={consent}
              onCustomerChange={setCustomer}
              onConsentChange={setConsent}
              submitting={createAppointment.isPending}
              issues={apiError?.issues ?? []}
              onSubmit={submit}
            />
          </Step>
        )}
      </Card>
    </Layout>
  );
}

function Layout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      {title && (
        <header className="mb-6">
          <p className="text-sm font-medium text-teal-700">Agende seu horário</p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </header>
      )}
      {children}
      <footer className="mt-10 text-center text-xs text-slate-400">Agendamento online por Lembrai</footer>
    </main>
  );
}
