import { Router } from "express";
import * as publicController from "../controllers/public.controller.js";

// Rotas SEM login, usadas pela página pública de agendamento (/agenda/:slug no front).
export const publicRoutes = Router();

publicRoutes.get("/establishments/:slug", publicController.getEstablishment);
publicRoutes.get("/establishments/:slug/availability", publicController.getAvailability);
