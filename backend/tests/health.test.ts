import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("GET /health", () => {
  it("responde 200 com status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("rota inexistente", () => {
  it("responde 404 em JSON", async () => {
    const res = await request(app).get("/nao-existe");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Rota não encontrada." });
  });
});
