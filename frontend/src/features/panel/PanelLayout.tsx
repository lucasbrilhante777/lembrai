import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuthenticatedSession, useLogout } from "../auth/api.ts";

export function PanelLayout() {
  const session = useAuthenticatedSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const { establishment, user } = session;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-teal-700">Lembrai</p>
            <p className="font-semibold text-slate-900">{establishment.name}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a
              href={`/agenda/${establishment.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal-700 hover:underline"
            >
              Ver página pública ↗
            </a>
            <span className="hidden text-slate-400 sm:inline">|</span>
            <span className="hidden text-slate-600 sm:inline">{user.name}</span>
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/entrar", { replace: true }) })}
              className="rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
            >
              Sair
            </button>
          </div>
        </div>
        <nav aria-label="Painel" className="mx-auto flex max-w-5xl gap-1 px-4">
          <PanelLink to="/painel" end>
            Agenda
          </PanelLink>
          <PanelLink to="/painel/servicos">Serviços</PanelLink>
          <PanelLink to="/painel/profissionais">Profissionais</PanelLink>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Repassa a sessão adiante para as páginas do painel. */}
        <Outlet context={session} />
      </main>
    </div>
  );
}

function PanelLink({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `border-b-2 px-3 py-2 text-sm font-medium ${isActive ? "border-teal-600 text-teal-700" : "border-transparent text-slate-600 hover:text-slate-900"}`
      }
    >
      {children}
    </NavLink>
  );
}
