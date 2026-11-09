import type { RequestHandler } from "express";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import { createServiceSchema, updateServiceSchema } from "../schemas/services.schemas.js";
import * as servicesService from "../services/services.service.js";

export const list: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  res.json(await servicesService.listServices(establishmentId));
};

export const create: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = createServiceSchema.parse(req.body);
  res.status(201).json(await servicesService.createService(establishmentId, input));
};

export const update: RequestHandler<{ id: string }> = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = updateServiceSchema.parse(req.body);
  res.json(await servicesService.updateService(establishmentId, req.params.id, input));
};
