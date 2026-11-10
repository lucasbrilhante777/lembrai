import type { ReactNode } from "react";
import { Link } from "react-router";

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link to="/" className="mb-6 text-sm font-semibold text-teal-700">
        Lembrai
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
      {children}
    </main>
  );
}
