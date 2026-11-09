import { Router } from "express";
import * as professionalsController from "../controllers/professionals.controller.js";

// Montado em app.ts atrás do ensureAuthenticated: todas as rotas exigem login.
// Como em serviços, não há DELETE: profissional que sai é desativado.
export const professionalsRoutes = Router();

professionalsRoutes.get("/", professionalsController.list);
professionalsRoutes.post("/", professionalsController.create);
professionalsRoutes.patch("/:id", professionalsController.update);
professionalsRoutes.put("/:id/working-hours", professionalsController.replaceWorkingHours);
