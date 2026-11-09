import type { RequestHandler } from "express";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import {
  createProfessionalSchema,
  replaceWorkingHoursSchema,
  updateProfessionalSchema,
} from "../schemas/professionals.schemas.js";
import * as professionalsService from "../services/professionals.service.js";

export const list: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  res.json(await professionalsService.listProfessionals(establishmentId));
};

export const create: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = createProfessionalSchema.parse(req.body);
  res.status(201).json(await professionalsService.createProfessional(establishmentId, input));
};

export const update: RequestHandler<{ id: string }> = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = updateProfessionalSchema.parse(req.body);
  res.json(await professionalsService.updateProfessional(establishmentId, req.params.id, input));
};

export const replaceWorkingHours: RequestHandler<{ id: string }> = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = replaceWorkingHoursSchema.parse(req.body);
  res.json(await professionalsService.replaceWorkingHours(establishmentId, req.params.id, input));
};
