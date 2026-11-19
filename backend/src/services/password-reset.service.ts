import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { passwordResetEmail } from "../emails/password-reset-email.js";
import { AppError } from "../errors/app-error.js";
import { runInBackground } from "../lib/background.js";
import { mailer } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import type { ForgotPasswordInput, ResetPasswordInput } from "../schemas/auth.schemas.js";
import { BCRYPT_ROUNDS } from "./auth.service.js";

export const RESET_TOKEN_TTL_MINUTES = 60;

export const RESET_ERRORS = { INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN" } as const;

// O token vai no e-mail; no banco fica só o SHA-256 dele (como uma senha).
// Aqui um hash rápido basta (não precisa de bcrypt): o token tem 256 bits aleatórios,
// então não dá para adivinhar na força bruta como se faz com senhas fracas.
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Pede o link de redefinição. A resposta é sempre a mesma, exista o e-mail ou não:
 * senão, a tela viraria um jeito de descobrir quem tem conta no Lembrai.
 */
export async function requestPasswordReset({ email }: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

  // Só o link mais recente vale: pedir de novo invalida os anteriores.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt } }),
  ]);

  // Sem await: esperar o SMTP faria a resposta demorar mais quando o e-mail existe,
  // e o tempo de resposta entregaria a informação que a mensagem genérica esconde.
  runInBackground("e-mail de redefinição de senha", () =>
    mailer.send(
      passwordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: `${env.FRONTEND_URL}/redefinir-senha/${token}`,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      }),
    ),
  );
}

/** Troca a senha usando o token do e-mail. Vale uma vez só, até expirar. */
export async function resetPassword({ token, password }: ResetPasswordInput) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });

    // "Gasta" o token com um UPDATE condicional: se duas requisições chegarem juntas com o
    // mesmo link, só uma consegue marcar usedAt (a outra vê count = 0). Mesma ideia do lembrete.
    const claimed = resetToken
      ? await tx.passwordResetToken.updateMany({
          where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        })
      : { count: 0 };

    if (!resetToken || claimed.count === 0) {
      throw new AppError(
        "Este link de redefinição é inválido ou já expirou. Peça um novo.",
        400,
        RESET_ERRORS.INVALID_RESET_TOKEN,
      );
    }

    // Senha nova + sessionVersion+1: quem estava logado com a senha antiga cai (ver ensureAuthenticated).
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, usedAt: null } });
  });
}
