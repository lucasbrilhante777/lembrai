import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

// Limita tentativas de login/cadastro por IP: dificulta adivinhar senhas na força bruta.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
  // Nos testes, todas as requisições vêm do mesmo IP e bateriam no limite.
  skip: () => env.NODE_ENV === "test",
});
