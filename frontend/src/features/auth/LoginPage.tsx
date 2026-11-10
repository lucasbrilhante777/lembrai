import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Alert, Card, PrimaryButton } from "../../components/ui.tsx";
import { TextField } from "../../components/form.tsx";
import { ApiError } from "../../lib/api.ts";
import { AuthLayout } from "./AuthLayout.tsx";
import { useLogin, useSession } from "./api.ts";

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Volta para a página que a pessoa tentou abrir antes de ser mandada para o login.
  const from = (location.state as { from?: string } | null)?.from ?? "/painel";

  if (session.data) return <Navigate to={from} replace />;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) });
  }

  const error = login.error instanceof ApiError ? login.error : null;

  return (
    <AuthLayout title="Entrar no painel">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error.message}</Alert>}
          <TextField label="E-mail" name="email" type="email" autoComplete="email" value={email} onChange={setEmail} />
          <TextField
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          <PrimaryButton type="submit" disabled={login.isPending}>
            {login.isPending ? "Entrando..." : "Entrar"}
          </PrimaryButton>
        </form>
      </Card>

      <div className="mt-4 space-y-2 text-center text-sm text-slate-600">
        <p>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-teal-700 hover:underline">
            Cadastre seu negócio
          </Link>
        </p>
        <p className="text-xs text-slate-500">
          Quer só conhecer? Entre com a conta demo: <strong>demo@example.com</strong> / <strong>lembrai-demo</strong>
        </p>
      </div>
    </AuthLayout>
  );
}
