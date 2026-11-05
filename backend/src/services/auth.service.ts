import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import { slugify } from "../utils/slugify.js";

const BCRYPT_ROUNDS = 10;

// Hash de uma senha qualquer, usado quando o e-mail não existe no login.
// Assim a resposta demora o mesmo tempo nos dois casos, e ninguém descobre
// quais e-mails têm conta medindo o tempo de resposta.
const DUMMY_HASH = bcrypt.hashSync("senha-que-nao-existe", BCRYPT_ROUNDS);

// No MVP, cada dono tem exatamente um estabelecimento, criado junto com a conta.
export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("Já existe uma conta com esse e-mail.", 409);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const slug = await generateUniqueSlug(input.establishmentName);

  // Escrita aninhada: o Prisma cria usuário e estabelecimento numa única transação.
  // Se um falhar, nenhum dos dois é salvo.
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      establishments: {
        create: { name: input.establishmentName, slug, timezone: input.timezone },
      },
    },
    include: { establishments: true },
  });

  return toSession(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { establishments: true },
  });

  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Mesma mensagem para "e-mail não existe" e "senha errada", de propósito.
  if (!user || !passwordMatches) throw new AppError("E-mail ou senha inválidos.", 401);

  return toSession(user);
}

export async function getSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { establishments: true },
  });
  if (!user) throw new AppError("Sessão inválida.", 401);

  return toSession(user);
}

async function generateUniqueSlug(name: string) {
  const base = slugify(name);
  let candidate = base;

  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await prisma.establishment.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    candidate = `${base}-${randomInt(1000, 10000)}`;
  }

  throw new AppError("Não foi possível gerar um endereço para o estabelecimento. Tente outro nome.", 409);
}

type UserWithEstablishments = {
  id: string;
  name: string;
  email: string;
  establishments: { id: string; name: string; slug: string; timezone: string }[];
};

// Formato devolvido para o front. Nunca inclui o passwordHash.
function toSession(user: UserWithEstablishments) {
  const establishment = user.establishments[0];
  if (!establishment) throw new AppError("Conta sem estabelecimento.", 500);

  return {
    user: { id: user.id, name: user.name, email: user.email },
    establishment: {
      id: establishment.id,
      name: establishment.name,
      slug: establishment.slug,
      timezone: establishment.timezone,
    },
  };
}
