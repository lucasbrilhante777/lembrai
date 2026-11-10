import type { FormEvent } from "react";
import { TextField } from "../../components/form.tsx";
import { PrimaryButton } from "../../components/ui.tsx";
import type { FieldIssue } from "../../lib/api.ts";
import type { CustomerInput } from "./api.ts";

type Props = {
  // Controlado pela página: se o horário for ocupado (409) e o formulário sumir,
  // o que o cliente digitou continua guardado e volta quando ele escolher outro horário.
  customer: CustomerInput;
  consent: boolean;
  onCustomerChange: (customer: CustomerInput) => void;
  onConsentChange: (consent: boolean) => void;
  submitting: boolean;
  /** Erros de validação devolvidos pela API (ex.: { path: "customer.email", message: "E-mail inválido." }). */
  issues: FieldIssue[];
  onSubmit: () => void;
};

export function CustomerForm({
  customer,
  consent,
  onCustomerChange,
  onConsentChange,
  submitting,
  issues,
  onSubmit,
}: Props) {
  const errorFor = (path: string) => issues.find((issue) => issue.path === path)?.message;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Seu nome"
        name="name"
        autoComplete="name"
        value={customer.name}
        error={errorFor("customer.name")}
        onChange={(name) => onCustomerChange({ ...customer, name })}
      />
      <TextField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        hint="A confirmação e o lembrete chegam aqui."
        value={customer.email}
        error={errorFor("customer.email")}
        onChange={(email) => onCustomerChange({ ...customer, email })}
      />
      <TextField
        label="Telefone (com DDD)"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="(81) 99999-9999"
        value={customer.phone}
        error={errorFor("customer.phone")}
        onChange={(phone) => onCustomerChange({ ...customer, phone })}
      />

      <div>
        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 size-4 accent-teal-600"
          />
          <span>
            Concordo com o uso do meu nome, e-mail e telefone para este agendamento e para receber o lembrete.
          </span>
        </label>
        {errorFor("consent") && <p className="mt-1 text-sm text-red-700">{errorFor("consent")}</p>}
      </div>

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "Confirmando..." : "Confirmar agendamento"}
      </PrimaryButton>
    </form>
  );
}
