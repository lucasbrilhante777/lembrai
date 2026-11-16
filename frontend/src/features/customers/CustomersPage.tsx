import { useState } from "react";
import { Link } from "react-router";
import { Alert, Card, Spinner } from "../../components/ui.tsx";
import { formatInstantDate, formatPhone, formatPrice } from "../../lib/format.ts";
import { useDebouncedValue } from "../../lib/use-debounced-value.ts";
import { useAuthenticatedSession } from "../auth/api.ts";
import { useCustomers } from "./api.ts";

export function CustomersPage() {
  const { timezone } = useAuthenticatedSession().establishment;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  // A página fica guardada JUNTO com a busca a que ela pertence. Quando a busca muda, a página
  // "vira" 1 sozinha (estado derivado), sem useEffect e sem uma chamada extra à API no meio do caminho.
  const [pageState, setPageState] = useState({ search: "", page: 1 });
  const page = pageState.search === debouncedSearch ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ search: debouncedSearch, page: next });
  const customers = useCustomers({ search: debouncedSearch, page });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-600">Quem já agendou com você, com o histórico de cada um.</p>
      </div>

      <div>
        <label htmlFor="customer-search" className="sr-only">
          Buscar cliente
        </label>
        <input
          id="customer-search"
          type="search"
          value={search}
          placeholder="Buscar por nome, e-mail ou telefone"
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-600 sm:max-w-md"
        />
      </div>

      {customers.isPending ? (
        <Spinner />
      ) : customers.isError ? (
        <Alert>{customers.error.message}</Alert>
      ) : customers.data.items.length === 0 ? (
        <Alert tone="info">
          {debouncedSearch ? `Nenhum cliente encontrado para "${debouncedSearch}".` : "Nenhum cliente ainda. Eles aparecem aqui quando agendam pela sua página."}
        </Alert>
      ) : (
        <>
          <Card className="overflow-x-auto p-0!">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium">Visitas</th>
                  <th className="px-4 py-3 text-right font-medium">Faltas</th>
                  <th className="px-4 py-3 text-right font-medium">Total gasto</th>
                  <th className="px-4 py-3 font-medium">Última visita</th>
                </tr>
              </thead>
              <tbody>
                {customers.data.items.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/painel/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-teal-700 hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {formatPhone(c.phone)} · {c.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">{c.completed}</td>
                    <td className="px-4 py-3 text-right">{c.noShows}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(c.totalSpentCents)}</td>
                    <td className="px-4 py-3">{c.lastVisitAt ? formatInstantDate(c.lastVisitAt, timezone) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              {customers.data.total} cliente(s) · página {customers.data.page} de {customers.data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:border-teal-500 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= customers.data.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:border-teal-500 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
