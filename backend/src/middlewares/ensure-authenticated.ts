import type { Request, RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { AUTH_COOKIE } from "../lib/auth-cookie.js";
import { type AuthPayload, verifyToken } from "../lib/token.js";

// Protege as rotas do painel: sem um token válido no cookie, responde 401.
export const ensureAuthenticated: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  const payload = typeof token === "string" ? verifyToken(token) : null;

  if (!payload) throw new AppError("Não autenticado.", 401);

  req.auth = payload;
  next();
};

// Usado nos controllers das rotas protegidas. Todo acesso a dados do painel
// deve usar o establishmentId daqui, nunca um id vindo do corpo da requisição.
export function getAuth(req: Request): AuthPayload {
  if (!req.auth) throw new AppError("Não autenticado.", 401);
  return req.auth;
}
