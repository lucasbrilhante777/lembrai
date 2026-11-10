import { Router } from "express";
import * as publicController from "../controllers/public.controller.js";

// Rotas SEM login, usadas pela página pública de agendamento (/agenda/:slug no front)
// e pela página de cancelamento (/cancelar/:token, o link do e-mail).
export const publicRoutes = Router();

publicRoutes.get("/establishments/:slug", publicController.getEstablishment);
publicRoutes.get("/establishments/:slug/availability", publicController.getAvailability);
publicRoutes.post("/establishments/:slug/appointments", publicController.createAppointment);

// GET só mostra; quem cancela é o POST (ver comentário em cancellation.service.ts).
publicRoutes.get("/appointments/:token", publicController.getAppointmentByToken);
publicRoutes.post("/appointments/:token/cancel", publicController.cancelAppointment);
