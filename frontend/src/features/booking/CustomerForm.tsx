import type { FormEvent } from "react";
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
      <Field
        label="Seu nome"
        name="name"
        autoComplete="name"
        value={customer.name}
        error={errorFor("customer.name")}
        onChange={(name) => onCustomerChange({ ...customer, name })}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        hint="A confirmação e o lembrete chegam aqui."
        value={customer.email}
        error={errorFor("customer.email")}
        onChange={(email) => onCustomerChange({ ...customer, email })}
      />
      <Field
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

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
};

function Field({ label, name, value, onChange, error, hint, type = "text", autoComplete, placeholder }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-600 ${
          error ? "border-red-400" : "border-slate-300"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
