import type { RequestHandler } from "express";
import { clearAuthCookie, setAuthCookie } from "../lib/auth-cookie.js";
import { signToken } from "../lib/token.js";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import { loginSchema, registerSchema } from "../schemas/auth.schemas.js";
import * as authService from "../services/auth.service.js";

// O controller só traduz HTTP <-> serviço: valida a entrada, chama a regra de negócio
// e monta a resposta. Se o Zod reprovar o body, o errorHandler responde 400.

export const register: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const session = await authService.register(input);

  setAuthCookie(res, signToken({ userId: session.user.id, establishmentId: session.establishment.id }));
  res.status(201).json(session);
};

export const login: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const session = await authService.login(input);

  setAuthCookie(res, signToken({ userId: session.user.id, establishmentId: session.establishment.id }));
  res.json(session);
};

export const logout: RequestHandler = (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  const { userId } = getAuth(req);
  res.json(await authService.getSession(userId));
};
