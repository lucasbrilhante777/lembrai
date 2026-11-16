import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { TextField } from "../../components/form.tsx";
import { Alert, Card, PrimaryButton } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { AuthLayout } from "./AuthLayout.tsx";
import { useForgotPassword } from "./api.ts";

// "Esqueci minha senha": a pessoa informa o e-mail e recebe um link.
// A tela de sucesso é a mesma exista a conta ou não (a API não conta, de propósito).
export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    forgot.mutate({ email });
  }

  const error = forgot.error instanceof ApiError ? forgot.error : null;
  const emailError = error?.issues.find((issue) => issue.path === "email")?.message;

  return (
    <AuthLayout title="Esqueci minha senha">
      <Card>
        {forgot.isSuccess ? (
          <div className="space-y-3 text-sm text-slate-700">
            <Alert tone="info">{forgot.data.message}</Alert>
            <p>Confira a caixa de entrada e o spam. O link vale por 1 hora.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-slate-600">Informe o e-mail da sua conta. Vamos mandar um link para criar uma nova senha.</p>
            {error && !emailError && <Alert>{error.message}</Alert>}
            <TextField
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              error={emailError}
            />
            <PrimaryButton type="submit" disabled={forgot.isPending}>
              {forgot.isPending ? "Enviando..." : "Enviar link"}
            </PrimaryButton>
          </form>
        )}
      </Card>

      <p className="mt-4 text-center text-sm">
        <Link to="/entrar" className="font-medium text-teal-700 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  );
}
