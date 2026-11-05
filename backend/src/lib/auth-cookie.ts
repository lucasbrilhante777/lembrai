import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";
import { TOKEN_TTL_SECONDS } from "./token.js";

export const AUTH_COOKIE = "lembrai_token";

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript do navegador não consegue ler: protege o token contra XSS
  secure: env.NODE_ENV === "production", // em produção, só trafega por HTTPS
  sameSite: "lax", // não é enviado em POSTs vindos de outros sites: protege contra CSRF
  path: "/",
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
}
