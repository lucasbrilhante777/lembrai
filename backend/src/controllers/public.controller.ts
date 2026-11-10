import type { RequestHandler } from "express";
import { availabilityQuerySchema, createAppointmentSchema } from "../schemas/public.schemas.js";
import * as cancellationService from "../services/cancellation.service.js";
import * as publicService from "../services/public.service.js";

export const getEstablishment: RequestHandler<{ slug: string }> = async (req, res) => {
  res.json(await publicService.getPublicEstablishment(req.params.slug));
};

export const getAvailability: RequestHandler<{ slug: string }> = async (req, res) => {
  const query = availabilityQuerySchema.parse(req.query);
  res.json(await publicService.getAvailability(req.params.slug, query));
};

export const createAppointment: RequestHandler<{ slug: string }> = async (req, res) => {
  const input = createAppointmentSchema.parse(req.body);
  res.status(201).json(await publicService.createAppointment(req.params.slug, input));
};

export const getAppointmentByToken: RequestHandler<{ token: string }> = async (req, res) => {
  res.json(await cancellationService.getAppointmentByToken(req.params.token));
};

export const cancelAppointment: RequestHandler<{ token: string }> = async (req, res) => {
  res.json(await cancellationService.cancelAppointmentByToken(req.params.token));
};
