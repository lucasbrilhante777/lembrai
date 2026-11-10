import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Alert, Card, PrimaryButton } from "../../components/ui.tsx";
import { TextField } from "../../components/form.tsx";
import { ApiError } from "../../lib/api.ts";
import { AuthLayout } from "./AuthLayout.tsx";
import { type RegisterInput, useRegister, useSession } from "./api.ts";

// Fusos mais comuns no Brasil. O cadastro já sugere o do navegador quando ele está na lista.
const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, GO, DF...)" },
  { value: "America/Recife", label: "Recife (PE, PB, RN, AL)" },
  { value: "America/Fortaleza", label: "Fortaleza (CE, PI, MA)" },
  { value: "America/Bahia", label: "Salvador (BA)" },
  { value: "America/Belem", label: "Belém (PA, AP)" },
  { value: "America/Manaus", label: "Manaus (AM)" },
  { value: "America/Cuiaba", label: "Cuiabá (MT)" },
  { value: "America/Campo_Grande", label: "Campo Grande (MS)" },
  { value: "America/Porto_Velho", label: "Porto Velho (RO)" },
  { value: "America/Rio_Branco", label: "Rio Branco (AC)" },
];

function browserTimezone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TIMEZONES.some((t) => t.value === tz) ? tz : "America/Sao_Paulo";
}

export function RegisterPage() {
  const session = useSession();
  const register = useRegister();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterInput>({
    name: "",
    email: "",
    password: "",
    establishmentName: "",
    timezone: browserTimezone(),
  });

  if (session.data) return <Navigate to="/painel" replace />;

  const error = register.error instanceof ApiError ? register.error : null;
  const errorFor = (path: string) => error?.issues.find((issue) => issue.path === path)?.message;
  const set = (field: keyof RegisterInput) => (value: string) => setForm({ ...form, [field]: value });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    register.mutate(form, { onSuccess: () => navigate("/painel", { replace: true }) });
  }

  return (
    <AuthLayout title="Cadastre seu negócio">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && error.issues.length === 0 && <Alert>{error.message}</Alert>}
          <TextField label="Seu nome" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errorFor("name")} />
          <TextField label="E-mail" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errorFor("email")} />
          <TextField
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="Pelo menos 8 caracteres."
            value={form.password}
            onChange={set("password")}
            error={errorFor("password")}
          />
          <TextField
            label="Nome do estabelecimento"
            name="establishmentName"
            hint='Vira o endereço da sua página, ex.: "Barbearia do Zé" → /agenda/barbearia-do-ze'
            value={form.establishmentName}
            onChange={set("establishmentName")}
            error={errorFor("establishmentName")}
          />
          <div>
            <label htmlFor="field-timezone" className="mb-1 block text-sm font-medium text-slate-700">
              Fuso horário
            </label>
            <select
              id="field-timezone"
              value={form.timezone}
              onChange={(e) => set("timezone")(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-600"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <PrimaryButton type="submit" disabled={register.isPending}>
            {register.isPending ? "Criando conta..." : "Criar conta"}
          </PrimaryButton>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Já tem conta?{" "}
        <Link to="/entrar" className="font-medium text-teal-700 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
