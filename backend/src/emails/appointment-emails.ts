import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import type { EmailMessage } from "../lib/mailer.js";

// Modelos dos e-mails enviados ao cliente final.
// Todo texto que vem do usuário (nome do cliente, do serviço etc.) passa por escapeHtml:
// sem isso, alguém poderia se cadastrar com o nome "<a href=...>" e injetar HTML no e-mail.

export type AppointmentEmailData = {
  to: string;
  customerName: string;
  establishmentName: string;
  serviceName: string;
  professionalName: string;
  startAt: Date;
  timezone: string;
  priceCents: number;
  cancelUrl: string;
};

export function confirmationEmail(data: AppointmentEmailData): EmailMessage {
  const when = formatWhen(data.startAt, data.timezone);
  return {
    to: data.to,
    subject: `Agendamento confirmado: ${data.serviceName} em ${data.establishmentName}`,
    html: layout(`
      <p>Olá, ${escapeHtml(data.customerName)}!</p>
      <p>Seu horário está confirmado:</p>
      ${detailsHtml(data, when)}
      <p>Você vai receber um lembrete 24 horas antes.</p>
      ${cancelHtml(data.cancelUrl)}
    `),
    text: [
      `Olá, ${data.customerName}!`,
      "",
      "Seu horário está confirmado:",
      detailsText(data, when),
      "",
      "Você vai receber um lembrete 24 horas antes.",
      `Não vai conseguir ir? Cancele aqui: ${data.cancelUrl}`,
    ].join("\n"),
  };
}

export function reminderEmail(data: AppointmentEmailData): EmailMessage {
  const when = formatWhen(data.startAt, data.timezone);
  return {
    to: data.to,
    // Data explícita, não "amanhã": se o job atrasar, o lembrete pode sair no mesmo dia do horário.
    subject: `Lembrete: ${data.serviceName} em ${data.establishmentName}, ${formatShortWhen(data.startAt, data.timezone)}`,
    html: layout(`
      <p>Olá, ${escapeHtml(data.customerName)}!</p>
      <p>Passando para lembrar do seu horário:</p>
      ${detailsHtml(data, when)}
      ${cancelHtml(data.cancelUrl)}
    `),
    text: [
      `Olá, ${data.customerName}!`,
      "",
      "Passando para lembrar do seu horário:",
      detailsText(data, when),
      "",
      `Não vai conseguir ir? Cancele aqui e libere o horário: ${data.cancelUrl}`,
    ].join("\n"),
  };
}

/** "terça-feira, 17 de novembro às 09:00", no fuso do estabelecimento (ADR 0002). */
export function formatWhen(startAt: Date, timezone: string) {
  return formatInTimeZone(startAt, timezone, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

/** "13/11 às 09:00", no fuso do estabelecimento. */
export function formatShortWhen(startAt: Date, timezone: string) {
  return formatInTimeZone(startAt, timezone, "dd/MM 'às' HH:mm");
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function detailsHtml(data: AppointmentEmailData, when: string) {
  const rows: [string, string][] = [
    ["Quando", when],
    ["Onde", data.establishmentName],
    ["Serviço", `${data.serviceName} (${formatPrice(data.priceCents)})`],
    ["Com", data.professionalName],
  ];
  return `<table style="border-collapse:collapse;margin:16px 0">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666">${label}</td><td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join("")}</table>`;
}

function detailsText(data: AppointmentEmailData, when: string) {
  return [
    `Quando: ${when}`,
    `Onde: ${data.establishmentName}`,
    `Serviço: ${data.serviceName} (${formatPrice(data.priceCents)})`,
    `Com: ${data.professionalName}`,
  ].join("\n");
}

function cancelHtml(cancelUrl: string) {
  return `<p style="margin-top:24px;color:#666">Não vai conseguir ir?
    <a href="${escapeHtml(cancelUrl)}">Cancele aqui</a> e libere o horário para outra pessoa.</p>`;
}

function layout(content: string) {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222;max-width:560px;margin:0 auto;padding:24px">
    ${content}
    <p style="margin-top:32px;font-size:12px;color:#999">Enviado pelo Lembrai. Você recebeu este e-mail porque agendou um horário.</p>
  </body>
</html>`;
}
