import type { RequestHandler } from "express";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import { listCustomersQuerySchema } from "../schemas/customers.schemas.js";
import * as customersService from "../services/customers.service.js";

export const list: RequestHandler = async (req, res) => {
  const { establishmentId } = getAuth(req);
  const query = listCustomersQuerySchema.parse(req.query);
  res.json(await customersService.listCustomers(establishmentId, query));
};

export const get: RequestHandler<{ id: string }> = async (req, res) => {
  const { establishmentId } = getAuth(req);
  res.json(await customersService.getCustomer(establishmentId, req.params.id));
};
