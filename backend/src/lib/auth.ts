import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Authentification de l'API.
//
// Le backend est sans état : il signe un JWT à la connexion et se contente
// ensuite de vérifier la signature du jeton présenté dans l'en-tête
// `Authorization: Bearer`. Il ne pose ni ne lit aucun cookie — c'est
// frontend-admin qui garde la session côté navigateur, sur son propre domaine.

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

// Le rôle est relu en base plutôt que pris dans le jeton : une promotion ou une
// rétrogradation prend effet immédiatement, sans attendre l'expiration du JWT.
export async function authenticateRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.sub }, include: { client: true } });
}

export type ApiUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>;
