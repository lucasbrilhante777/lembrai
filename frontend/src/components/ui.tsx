import type { ButtonHTMLAttributes, ReactNode } from "react";

// Peças visuais reaproveitadas entre as telas.

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${number}`} className="space-y-3">
      <h2 id={`step-${number}`} className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <span className="flex size-6 items-center justify-center rounded-full bg-teal-600 text-xs text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Botão de escolha (serviço, profissional, dia, horário). aria-pressed diz ao leitor de tela qual está marcado. */
export function OptionButton({
  selected,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
          : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/40"
      } ${className}`}
      {...props}
    />
  );
}

/** `danger` para ações destrutivas (ex.: cancelar). A cor vem da variante, não de classes sobrepostas. */
export function PrimaryButton({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" }) {
  const colors =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
      : "bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600";
  return (
    <button
      className={`w-full rounded-xl px-4 py-3 font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${colors} ${className}`}
      {...props}
    />
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
      {label}...
    </div>
  );
}
