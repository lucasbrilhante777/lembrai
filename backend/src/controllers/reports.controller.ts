import type { RequestHandler } from "express";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import { reportQuerySchema } from "../schemas/reports.schemas.js";
import * as reportsService from "../services/reports.service.js";

export const summary: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const query = reportQuerySchema.parse(req.query);
  res.json(await reportsService.getSummary(establishmentId, query));
};
