import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-bold text-teal-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">Página não encontrada</h1>
      <Link to="/" className="mt-6 font-medium text-teal-700 hover:underline">
        Voltar para o início
      </Link>
    </main>
  );
}
