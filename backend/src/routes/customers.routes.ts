import { Router } from "express";
import * as customersController from "../controllers/customers.controller.js";

// Clientes do estabelecimento. Montado em app.ts atrás do ensureAuthenticated.
// Só leitura: os clientes são criados pela página pública, ao agendar.
export const customersRoutes = Router();

customersRoutes.get("/", customersController.list);
customersRoutes.get("/:id", customersController.get);
