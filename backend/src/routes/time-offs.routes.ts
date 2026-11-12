import { Router } from "express";
import * as timeOffsController from "../controllers/time-offs.controller.js";

// Bloqueios de agenda. Montado em app.ts atrás do ensureAuthenticated.
// Aqui existe DELETE (diferente de serviços/profissionais): um bloqueio não tem histórico que dependa dele.
export const timeOffsRoutes = Router();

timeOffsRoutes.get("/", timeOffsController.list);
timeOffsRoutes.post("/", timeOffsController.create);
timeOffsRoutes.delete("/:id", timeOffsController.remove);
