import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { type EmailMessage, mailer } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, at, setupEstablishment } from "./helpers/establishment.js";

const app = createApp();

function book(setup: EstablishmentSetup, customerName = "Maria Silva") {
  return request(app)
    .post(`/public/establishments/${setup.slug}/appointments`)
    .send({
      serviceId: setup.serviceId,
      professionalId: setup.professionalId,
      startAt: at("09:00"),
      customer: { name: customerName, email: "maria@teste.com", phone: "81999999999" },
      consent: true,
    });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("e-mail de confirmação", () => {
  it("é enviado ao cliente com os detalhes e o link de cancelamento", async () => {
    const send = vi.spyOn(mailer, "send");
    const setup = await setupEstablishment(app);

    const res = await book(setup);

    expect(res.status).toBe(201);
    expect(send).toHaveBeenCalledOnce();
    const email = send.mock.calls[0]![0] as EmailMessage;
    const { cancelToken } = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.id } });

    expect(email.to).toBe("maria@teste.com");
    expect(email.subject).toBe("Agendamento confirmado: Corte em Barbearia Teste");
    expect(email.text).toContain("09:00");
    // \s porque o Intl usa espaço não separável (U+00A0) entre "R$" e o valor.
    expect(email.text).toMatch(/R\$\s35,00/);
    expect(email.text).toContain(`/cancelar/${cancelToken}`);
    expect(email.html).toContain(`/cancelar/${cancelToken}`);
  });

  it("escapa o HTML de dados digitados pelo cliente", async () => {
    const send = vi.spyOn(mailer, "send");
    const setup = await setupEstablishment(app);

    await book(setup, '<a href="https://golpe.com">Maria</a>');

    const email = send.mock.calls[0]![0] as EmailMessage;
    expect(email.html).not.toContain('<a href="https://golpe.com">');
    expect(email.html).toContain("&lt;a href=&quot;https://golpe.com&quot;&gt;Maria&lt;/a&gt;");
  });

  it("se o envio falhar, o agendamento continua salvo", async () => {
    vi.spyOn(mailer, "send").mockRejectedValue(new Error("SMTP fora do ar"));
    vi.spyOn(console, "error").mockImplementation(() => {}); // o erro é esperado; não poluir a saída
    const setup = await setupEstablishment(app);

    const res = await book(setup);

    expect(res.status).toBe(201);
    expect(await prisma.appointment.count()).toBe(1);
  });
});
