import { Router } from "express";
import * as appointmentsController from "../controllers/appointments.controller.js";

// Agenda do dono. Montado em app.ts atrás do ensureAuthenticated.
// Os agendamentos são criados pela rota pública; aqui o dono consulta e atualiza o status.
export const appointmentsRoutes = Router();

appointmentsRoutes.get("/", appointmentsController.list);
appointmentsRoutes.patch("/:id/status", appointmentsController.updateStatus);
