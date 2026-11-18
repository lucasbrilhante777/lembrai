import { describe, expect, it } from "vitest";
import { isReservedAddress, mailer } from "../src/lib/mailer.js";

// A conta demo usa @example.com. Com o SMTP ligado em produção, mandar para esses endereços
// só geraria devoluções (bounces) e queimaria a reputação da conta no provedor.

const message = { subject: "Teste", html: "<p>Teste</p>", text: "Teste" };

describe("endereços reservados (RFC 2606 / 6761)", () => {
  it.each([
    "ana.oliveira@example.com",
    "alguem@EXAMPLE.ORG",
    "x@example.net",
    "x@loja.test",
    "x@algo.invalid",
    "x@app.localhost",
    "x@site.example",
  ])("%s é reservado", (email) => {
    expect(isReservedAddress(email)).toBe(true);
  });

  it.each(["lucas@gmail.com", "dono@teste.com", "x@example.com.br", "x@myexample.com", "x@testes.com"])(
    "%s é um endereço de verdade",
    (email) => {
      expect(isReservedAddress(email)).toBe(false);
    },
  );
});

describe("mailer.send", () => {
  it("não envia para endereço reservado", async () => {
    expect(await mailer.send({ ...message, to: "ana.oliveira@example.com" })).toBe("skipped");
  });

  it("envia para endereço real", async () => {
    expect(await mailer.send({ ...message, to: "dono@teste.com" })).toBe("sent");
  });
});
