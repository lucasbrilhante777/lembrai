import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AuthPayload = {
  userId: string;
  establishmentId: string;
};

export const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 horas

export function signToken({ userId, establishmentId }: AuthPayload) {
  return jwt.sign({ est: establishmentId }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: TOKEN_TTL_SECONDS,
    algorithm: "HS256",
  });
}

// Retorna null para qualquer token inválido: assinatura errada, expirado ou malformado.
export function verifyToken(token: string): AuthPayload | null {
  try {
    // Fixar o algoritmo impede o ataque de trocar o "alg" do token por outro.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub || typeof payload.est !== "string") return null;

    return { userId: payload.sub, establishmentId: payload.est };
  } catch {
    return null;
  }
}
