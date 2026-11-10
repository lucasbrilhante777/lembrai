import { Link } from "react-router";

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold text-teal-700">Lembrai</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
        Agendamento online e lembretes automáticos para o seu negócio.
      </h1>
      <p className="mt-4 text-slate-600">
        Seu cliente marca o horário sozinho, sem criar conta, e recebe um lembrete por e-mail antes. Você acompanha tudo
        numa agenda simples, sem caderno e sem WhatsApp.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/agenda/barbearia-demo"
          className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700"
        >
          Ver a página de agendamento (demo)
        </Link>
        <Link
          to="/entrar"
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700"
        >
          Entrar no painel
        </Link>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Conta demo: <strong>demo@example.com</strong> / <strong>lembrai-demo</strong>
      </p>
    </main>
  );
}
