import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { healthRoutes } from "./routes/health.routes.js";

// Monta a aplicação sem chamar listen(). Assim os testes usam o app
// direto com o Supertest, sem abrir porta de verdade.
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json());

  app.use("/health", healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
