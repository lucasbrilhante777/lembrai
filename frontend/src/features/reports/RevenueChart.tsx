import { useState } from "react";
import { formatPrice, formatShortDate as shortDate } from "../../lib/format.ts";
import { niceMax } from "./math.ts";

type Day = { date: string; revenueCents: number; completed: number };

const CHART_HEIGHT = 180; // px da área das barras
const compactBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" });

// Receita por dia, em colunas. Uma série só: sem legenda (o título já diz o que é).
// Especificações de visualização: barra de no máximo 24px, ponta superior arredondada (4px) e base reta,
// 2px de espaço entre barras, grade em linha fina e cinza, dica ao passar o mouse ou focar com o teclado,
// e uma visão em tabela com os mesmos números (acessibilidade e leitura exata).
export function RevenueChart({ days }: { days: Day[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const maxCents = niceMax(Math.max(...days.map((d) => d.revenueCents), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxCents);
  const active = hovered !== null ? days[hovered] : null;
  // Rótulos do eixo X só no começo, meio e fim: um rótulo por barra viraria uma parede de texto.
  const labelIndexes = new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Receita por dia</h2>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          aria-pressed={showTable}
          className="rounded-lg px-2 py-1 text-sm font-medium text-teal-700 hover:bg-teal-50"
        >
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Dia</th>
                <th className="px-3 py-2 text-right font-medium">Atendimentos</th>
                <th className="px-3 py-2 text-right font-medium">Receita</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{shortDate(d.date)}</td>
                  <td className="px-3 py-1.5 text-right">{d.completed}</td>
                  <td className="px-3 py-1.5 text-right">{formatPrice(d.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // pt-3: o rótulo do topo do eixo fica centralizado na linha de cima e precisa de espaço até o título.
        <figure aria-label="Gráfico de receita por dia" className="relative pt-3">
          <div className="flex gap-2">
            {/* Eixo Y */}
            <div className="relative w-16 shrink-0 text-right text-xs text-slate-500" style={{ height: CHART_HEIGHT }}>
              {ticks.map((t) => (
                <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / maxCents) * 100}%` }}>
                  {compactBRL.format(t / 100)}
                </span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1" style={{ height: CHART_HEIGHT }}>
              {/* Grade: linhas finas e discretas */}
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 border-t border-slate-200" style={{ bottom: `${(t / maxCents) * 100}%` }} />
              ))}

              {/* Barras: crescem a partir da base; 2px de espaço entre elas */}
              <div className="absolute inset-0 flex items-end gap-0.5" onMouseLeave={() => setHovered(null)}>
                {days.map((d, i) => (
                  <div
                    key={d.date}
                    // A área de "acerto" é a coluna inteira (mais fácil de mirar que a barra fina).
                    className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none focus-visible:bg-teal-50"
                    tabIndex={0}
                    aria-label={`${shortDate(d.date)}: ${formatPrice(d.revenueCents)}, ${d.completed} atendimento(s)`}
                    onMouseEnter={() => setHovered(i)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                  >
                    <div
                      className={`w-full max-w-6 rounded-t-[4px] ${hovered === i ? "bg-teal-700" : "bg-teal-600"}`}
                      style={{ height: `${(d.revenueCents / maxCents) * 100}%` }}
                    />
                  </div>
                ))}
              </div>

              {active && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-0 z-10 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow"
                  style={{
                    // Acompanha a barra, mas sem sair da área do gráfico nas pontas.
                    left: `clamp(0px, calc(${((hovered! + 0.5) / days.length) * 100}% - 60px), calc(100% - 120px))`,
                  }}
                >
                  <p className="font-semibold">{shortDate(active.date)}</p>
                  <p>{formatPrice(active.revenueCents)}</p>
                  <p className="text-slate-300">{active.completed} atendimento(s)</p>
                </div>
              )}
            </div>
          </div>

          {/* Eixo X: só alguns rótulos. Primeiro colado à esquerda, último à direita (nunca passam da borda),
              os do meio centralizados na própria barra. */}
          <div className="relative ml-18 mt-1 h-4 text-xs whitespace-nowrap text-slate-500">
            {days.map((d, i) => {
              if (!labelIndexes.has(i)) return null;
              const position =
                i === 0
                  ? { left: 0 }
                  : i === days.length - 1
                    ? { right: 0 }
                    : { left: `${((i + 0.5) / days.length) * 100}%`, transform: "translateX(-50%)" };
              return (
                <span key={d.date} className="absolute" style={position}>
                  {shortDate(d.date)}
                </span>
              );
            })}
          </div>
        </figure>
      )}
    </div>
  );
}
