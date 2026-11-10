import { Navigate, Outlet, useLocation } from "react-router";
import { Spinner } from "../../components/ui.tsx";
import { useSession } from "./api.ts";

// Envolve as rotas do painel: sem sessão, manda para o login e guarda para onde a pessoa queria ir.
// Isso é conforto visual: quem protege os dados de verdade é a API (que responde 401 sem o cookie).
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }

  // Entrega a sessão para as telas de dentro. Elas só são renderizadas com sessão válida,
  // então não precisam lidar com "null" (nem usar `!`, que desligaria a checagem do TypeScript).
  return <Outlet context={session.data} />;
}
