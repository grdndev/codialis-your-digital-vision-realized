import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { hashApiToken, isApiToken } from "@/lib/api-tokens";

// Authentification de l'API.
//
// Le backend est sans état : il signe un JWT à la connexion et se contente
// ensuite de vérifier la signature du jeton présenté dans l'en-tête
// `Authorization: Bearer`. Il ne pose ni ne lit aucun cookie — c'est
// frontend-admin qui garde la session côté navigateur, sur son propre domaine.
//
// Le même en-tête accepte un jeton d'API personnel (`cdl_…`, voir
// api-tokens.ts) : c'est ainsi qu'un script ou Claude Code appelle l'API sans
// mot de passe.

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { sub: string; role: Role };

export async function signSessionToken(userId: string, role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

// Comment la requête s'est authentifiée. Un jeton d'API agit au nom de son
// propriétaire mais n'est pas une session : il ne gère pas les jetons (un
// jeton volé ne doit pas pouvoir s'en fabriquer d'autres qui survivraient à sa
// révocation), et un jeton en lecture seule ne passe que les GET.
export type AuthMethod =
  | { via: "session" }
  | { via: "token"; tokenId: string; readOnly: boolean };

// On ne réécrit la dernière utilisation qu'une fois par période : un script
// qui enchaîne cent appels ne doit pas coûter cent écritures.
const LAST_USED_RESOLUTION_MS = 5 * 60_000;

async function authenticateApiToken(raw: string) {
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(raw) },
    include: { user: { include: { client: true } } },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt <= new Date()) return null;
  // Réservé aux comptes internes : un compte client passé par l'écran garde
  // son portail, rien de plus. Un compte rétrogradé en client perd ses jetons
  // à l'instant, sans attendre qu'on les révoque.
  if (row.user.role === "CLIENT") return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  }
  const auth: AuthMethod = { via: "token", tokenId: row.id, readOnly: row.readOnly };
  return { user: row.user, auth };
}

// Le rôle est relu en base plutôt que pris dans le jeton : une promotion ou une
// rétrogradation prend effet immédiatement, sans attendre l'expiration du JWT.
export async function authenticateRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  if (isApiToken(token)) return authenticateApiToken(token);
  const session = await verifySessionToken(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub }, include: { client: true } });
  if (!user) return null;
  const auth: AuthMethod = { via: "session" };
  return { user, auth };
}

export type ApiUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>["user"];
