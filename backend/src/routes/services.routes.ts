import { Router } from "express";
import * as servicesController from "../controllers/services.controller.js";

// Montado em app.ts atrás do ensureAuthenticated: todas as rotas exigem login.
// Não existe DELETE de propósito: serviço com histórico é desativado (active: false).
export const servicesRoutes = Router();

servicesRoutes.get("/", servicesController.list);
servicesRoutes.post("/", servicesController.create);
servicesRoutes.patch("/:id", servicesController.update);
