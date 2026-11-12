import { Router } from "express";
import * as reportsController from "../controllers/reports.controller.js";

// Relatórios do painel. Montado em app.ts atrás do ensureAuthenticated.
export const reportsRoutes = Router();

reportsRoutes.get("/summary", reportsController.summary);
