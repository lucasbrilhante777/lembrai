import { Router } from "express";

export const healthRoutes = Router();

// Usada pelo Render/Railway (e por você) para saber se a API está de pé.
healthRoutes.get("/", (_req, res) => {
  res.json({ status: "ok" });
});
