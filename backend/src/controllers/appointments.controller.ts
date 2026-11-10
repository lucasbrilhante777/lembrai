import type { RequestHandler } from "express";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import { listAppointmentsQuerySchema, updateStatusSchema } from "../schemas/appointments.schemas.js";
import * as appointmentsService from "../services/appointments.service.js";

export const list: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const query = listAppointmentsQuerySchema.parse(req.query);
  res.json(await appointmentsService.listAppointments(establishmentId, query));
};

export const updateStatus: RequestHandler<{ id: string }> = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const input = updateStatusSchema.parse(req.body);
  res.json(await appointmentsService.updateStatus(establishmentId, req.params.id, input));
};
