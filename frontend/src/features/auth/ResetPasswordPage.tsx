import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";
import { TextField } from "../../components/form.tsx";
import { Alert, Card, PrimaryButton } from "../../components/ui.tsx";
import { ApiError } from "../../lib/api.ts";
import { AuthLayout } from "./AuthLayout.tsx";
import { useResetPassword } from "./api.ts";

// Página do link do e-mail (/redefinir-senha/:token). Só troca a senha no clique (POST),
// pelo mesmo motivo da página de cancelar: leitores de e-mail abrem links sozinhos.
export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Conferir a repetição é só no front: a API recebe a senha uma vez.
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    reset.mutate({ token, password });
  }

  const error = reset.error instanceof ApiError ? reset.error : null;
  const passwordError = error?.issues.find((issue) => issue.path === "password")?.message;
  const invalidLink = error?.code === "INVALID_RESET_TOKEN";

  if (reset.isSuccess) {
    return (
      <AuthLayout title="Senha alterada">
        <Card className="space-y-4">
          <Alert tone="info">Pronto! Sua senha foi alterada. Por segurança, saímos da sua conta em todos os aparelhos.</Alert>
          <Link
            to="/entrar"
            className="block rounded-xl bg-teal-700 px-4 py-2.5 text-center font-medium text-white hover:bg-teal-800"
          >
            Entrar com a nova senha
          </Link>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar nova senha">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {invalidLink ? (
            <Alert>
              {error.message}{" "}
              <Link to="/esqueci-senha" className="font-medium underline">
                Pedir um novo link
              </Link>
            </Alert>
          ) : (
            error && !passwordError && <Alert>{error.message}</Alert>
          )}
          <TextField
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="Pelo menos 8 caracteres."
            value={password}
            onChange={setPassword}
            error={passwordError}
          />
          <TextField
            label="Repita a nova senha"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={setConfirmation}
            error={mismatch ? "As senhas não são iguais." : undefined}
          />
          <PrimaryButton type="submit" disabled={reset.isPending}>
            {reset.isPending ? "Salvando..." : "Salvar nova senha"}
          </PrimaryButton>
        </form>
      </Card>
    </AuthLayout>
  );
}
