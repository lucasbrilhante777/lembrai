import type { Request, RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { AUTH_COOKIE } from "../lib/auth-cookie.js";
import { prisma } from "../lib/prisma.js";
import { type AuthPayload, verifyToken } from "../lib/token.js";

// Protege as rotas do painel: sem um token válido no cookie, responde 401.
//
// O JWT sozinho não dá pra "desligar": ele vale até expirar. Para a troca de senha derrubar
// as sessões antigas (ex.: alguém roubou a senha e já estava logado), o token carrega o
// sessionVersion do usuário, e aqui conferimos com o banco. O custo é uma consulta por chave
// primária a cada requisição do painel.
export const ensureAuthenticated: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  const payload = typeof token === "string" ? verifyToken(token) : null;
  if (!payload) throw new AppError("Não autenticado.", 401);

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { sessionVersion: true } });
  if (user?.sessionVersion !== payload.sessionVersion) throw new AppError("Sessão expirada. Entre de novo.", 401);

  req.auth = payload;
  next();
};

// Usado nos controllers das rotas protegidas. Todo acesso a dados do painel
// deve usar o establishmentId daqui, nunca um id vindo do corpo da requisição.
export function getAuth(req: Request): AuthPayload {
  if (!req.auth) throw new AppError("Não autenticado.", 401);
  return req.auth;
}
