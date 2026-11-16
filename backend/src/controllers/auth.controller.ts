import type { RequestHandler } from "express";
import { clearAuthCookie, setAuthCookie } from "../lib/auth-cookie.js";
import { signToken } from "../lib/token.js";
import { getAuth } from "../middlewares/ensure-authenticated.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../schemas/auth.schemas.js";
import * as authService from "../services/auth.service.js";
import * as passwordResetService from "../services/password-reset.service.js";

// O controller só traduz HTTP <-> serviço: valida a entrada, chama a regra de negócio
// e monta a resposta. Se o Zod reprovar o body, o errorHandler responde 400.

export const register: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const { session, auth } = await authService.register(input);

  setAuthCookie(res, signToken(auth));
  res.status(201).json(session);
};

export const login: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const { session, auth } = await authService.login(input);

  setAuthCookie(res, signToken(auth));
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

// Sempre 202 com a mesma mensagem, exista a conta ou não (ver password-reset.service).
export const forgotPassword: RequestHandler = async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  await passwordResetService.requestPasswordReset(input);

  res.status(202).json({
    message: "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha.",
  });
};

export const resetPassword: RequestHandler = async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await passwordResetService.resetPassword(input);

  // Não loga automaticamente: a pessoa entra com a senha nova, e o cookie antigo (se houver) sai.
  clearAuthCookie(res);
  res.status(204).end();
};
