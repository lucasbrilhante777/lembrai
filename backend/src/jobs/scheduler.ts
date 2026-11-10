import cron from "node-cron";
import { sendDueReminders } from "./reminders.job.js";

// Agenda as tarefas periódicas. Chamado só pelo server.ts: os testes importam o app
// sem ligar o relógio e chamam sendDueReminders() direto, com o "agora" que quiserem.
export function startJobs() {
  cron.schedule(
    "*/15 * * * *", // a cada 15 minutos
    async () => {
      try {
        const { sent } = await sendDueReminders();
        if (sent > 0) console.log(`📧 ${sent} lembrete(s) enviado(s)`);
      } catch (err) {
        // Ex.: banco fora do ar. Loga e tenta de novo na próxima rodada, sem derrubar a API.
        console.error("Falha na rodada de lembretes:", err);
      }
    },
    // Se uma execução demorar mais de 15 min, a próxima não começa por cima dela.
    { name: "lembretes", noOverlap: true },
  );
}
