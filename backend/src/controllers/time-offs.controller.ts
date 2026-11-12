import type { RequestHandler } from "express";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import { createTimeOffSchema, listTimeOffsQuerySchema } from "../schemas/time-offs.schemas.js";
import * as timeOffsService from "../services/time-offs.service.js";

export const list: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const query = listTimeOffsQuerySchema.parse(req.query);
  res.json(await timeOffsService.listTimeOffs(establishmentId, query));
};

export const create: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = createTimeOffSchema.parse(req.body);
  res.status(201).json(await timeOffsService.createTimeOff(establishmentId, input));
};

export const remove: RequestHandler<{ id: string }> = async (req, res) => {
  const { establishmentId } = getAuth(req);
  await timeOffsService.deleteTimeOff(establishmentId, req.params.id);
  res.status(204).end();
};
