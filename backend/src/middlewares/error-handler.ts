import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

// Rota não encontrada: responde 404 em JSON em vez da página HTML padrão do Express.
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
};

// Ponto único de tratamento de erros. No Express 5, erros lançados dentro de
// handlers async chegam aqui automaticamente, sem precisar de try/catch em cada rota.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Dados inválidos.",
      issues: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  // Erro inesperado: loga o detalhe no servidor, mas não vaza nada para o cliente.
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor." });
};
