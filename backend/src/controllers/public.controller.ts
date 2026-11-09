import type { RequestHandler } from "express";
import { availabilityQuerySchema } from "../schemas/public.schemas.js";
import * as publicService from "../services/public.service.js";

export const getEstablishment: RequestHandler<{ slug: string }> = async (req, res) => {
  res.json(await publicService.getPublicEstablishment(req.params.slug));
};

export const getAvailability: RequestHandler<{ slug: string }> = async (req, res) => {
  const query = availabilityQuerySchema.parse(req.query);
  res.json(await publicService.getAvailability(req.params.slug, query));
};
