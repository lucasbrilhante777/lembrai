// Tarefas que não devem atrasar a resposta HTTP (ex.: mandar e-mail).
//
// Por quê: o agendamento já está salvo quando o e-mail sai. Se a resposta esperasse o SMTP,
// um provedor lento (ou uma porta bloqueada, como no plano grátis do Render) deixaria o cliente
// olhando uma tela carregando, e o proxy acabaria devolvendo erro para um agendamento que deu certo.
//
// As tarefas ficam registradas para dar para esperar todas: os testes fazem isso antes de
// conferir os e-mails, e antes de limpar o banco para o próximo teste.

const pending = new Set<Promise<void>>();

/** Roda `task` sem que quem chamou espere. Um erro só é registrado no log, nunca derruba a API. */
export function runInBackground(label: string, task: () => Promise<unknown>) {
  const promise: Promise<void> = task()
    .then(() => undefined)
    .catch((err: unknown) => console.error(`Falha em segundo plano (${label}):`, err))
    .finally(() => pending.delete(promise));
  pending.add(promise);
}

/** Espera todas as tarefas em segundo plano terminarem (inclusive as que forem criadas enquanto espera). */
export async function settleBackgroundTasks() {
  while (pending.size > 0) await Promise.all(pending);
}
