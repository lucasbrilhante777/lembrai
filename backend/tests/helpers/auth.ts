import type { Express } from "express";
import request from "supertest";

let counter = 0;

// Cadastra um dono novo e devolve um "agent" já logado (guarda o cookie como um navegador).
export async function createLoggedOwner(app: Express, establishmentName = "Barbearia Teste") {
  counter++;
  const agent = request.agent(app);

  const res = await agent.post("/auth/register").send({
    name: `Dono ${counter}`,
    email: `dono${counter}@teste.com`,
    password: "senha-forte-123",
    establishmentName,
    timezone: "America/Recife",
  });
  if (res.status !== 201) throw new Error(`Falha ao criar dono de teste: ${JSON.stringify(res.body)}`);

  return { agent, establishmentId: res.body.establishment.id as string };
}
