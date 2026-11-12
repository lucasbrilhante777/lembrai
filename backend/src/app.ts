import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { ensureAuthenticated } from "./middlewares/ensure-authenticated.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { publicRateLimit } from "./middlewares/rate-limit.js";
import { appointmentsRoutes } from "./routes/appointments.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { professionalsRoutes } from "./routes/professionals.routes.js";
import { publicRoutes } from "./routes/public.routes.js";
import { servicesRoutes } from "./routes/services.routes.js";
import { timeOffsRoutes } from "./routes/time-offs.routes.js";

// Monta a aplicação sem chamar listen(). Assim os testes usam o app
// direto com o Supertest, sem abrir porta de verdade.
export function createApp() {
  const app = express();

  // Confia nos N proxies à frente da API (Vercel + Render em produção) para descobrir o IP real
  // do cliente no X-Forwarded-For. Usado pelo rate limit. Em dev e nos testes é 0 (sem proxy).
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use("/health", healthRoutes);
  app.use("/auth", authRoutes);
  app.use("/public", publicRateLimit, publicRoutes);

  // Rotas do painel: o login é exigido aqui, uma vez, para o grupo inteiro.
  app.use("/services", ensureAuthenticated, servicesRoutes);
  app.use("/professionals", ensureAuthenticated, professionalsRoutes);
  app.use("/appointments", ensureAuthenticated, appointmentsRoutes);
  app.use("/time-offs", ensureAuthenticated, timeOffsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
