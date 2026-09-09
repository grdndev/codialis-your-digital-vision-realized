import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { UserTokenKind } from "@prisma/client";

// Jetons à usage unique et expirants : confirmation d'adresse, réinitialisation
// de mot de passe.
//
// Le jeton en clair ne voyage que dans le lien envoyé par e-mail ; la base n'en
// garde que le SHA-256. Une fuite de la base ne permet donc pas de rejouer les
// liens contre les routes.

// Durées de vie. La confirmation est généreuse (on crée un compte, la personne
// peut ne relever ses messages que le lendemain) ; la réinitialisation est
// courte, c'est une action sensible qu'on vient de demander.
const TTL_MINUTES: Record<UserTokenKind, number> = {
  VERIFY: 48 * 60,
  RESET: 60,
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Émet un jeton frais et invalide les précédents non utilisés du même type :
// seul le dernier lien envoyé fonctionne. Renvoie le jeton EN CLAIR, à ne
// mettre que dans l'e-mail.
export async function createToken(userId: string, kind: UserTokenKind): Promise<string> {
  await prisma.userToken.updateMany({
    where: { userId, kind, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = randomBytes(32).toString("hex");
  await prisma.userToken.create({
    data: {
      userId,
      kind,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL_MINUTES[kind] * 60_000),
    },
  });
  return raw;
}

// Valide un jeton SANS le consommer : les routes ont besoin de vérifier avant
// d'agir, puis de consommer seulement si l'action a abouti.
export async function peekToken(
  raw: string,
  kind: UserTokenKind,
): Promise<{ id: string; userId: string } | null> {
  if (!raw) return null;
  const row = await prisma.userToken.findFirst({
    where: { tokenHash: hashToken(raw), kind, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  return row;
}

export async function consumeToken(tokenId: string): Promise<void> {
  await prisma.userToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
}

// --- Désinscription newsletter ---------------------------------------------
//
// Pas de ligne en base : le lien porte l'adresse et un HMAC de celle-ci. Sans
// état à stocker ni à expirer, et infalsifiable sans le secret.

function unsubscribeSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export function signUnsubscribe(email: string): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = Buffer.from(signUnsubscribe(email));
  const given = Buffer.from(token);
  // `timingSafeEqual` exige des longueurs égales, et compare sans fuite de
  // temps — un HMAC ne se vérifie pas avec `===`.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
