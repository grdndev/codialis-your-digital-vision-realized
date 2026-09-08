import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { authenticateRequest, type ApiUser } from "@/lib/auth";

// Ossature des routes /api/admin/*.
//
// Ces routes ne sont appelées que par le serveur de frontend-admin, jamais par
// un navigateur : pas de CORS, pas de preflight, pas de cookie. Seule
// l'authentification Bearer compte, et c'est ICI que les droits sont réellement
// appliqués — les gardes côté frontend ne servent qu'à éviter d'afficher un
// écran interdit.

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function badRequest(message: string): never {
  throw new HttpError(message, 400);
}

export function notFound(message = "Introuvable"): never {
  throw new HttpError(message, 404);
}

export type AdminContext = { user: ApiUser };

function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// `roles` vide = toute session valide est acceptée (utilisé par /me).
export function adminRoute<C>(
  roles: Role[],
  handler: (ctx: AdminContext, request: NextRequest, routeCtx: C) => Promise<unknown>,
) {
  return async (request: NextRequest, routeCtx: C) => {
    let user: ApiUser | null;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      console.error("Échec de la vérification de session:", err);
      return errorJson("Erreur serveur", 500);
    }
    if (!user) return errorJson("Non authentifié", 401);
    if (roles.length > 0 && !roles.includes(user.role)) return errorJson("Accès refusé", 403);

    try {
      const data = await handler({ user }, request, routeCtx);
      // Une mutation qui ne renvoie rien répond `{ ok: true }` : le frontend
      // n'a besoin que de savoir que c'est passé.
      return NextResponse.json(data === undefined ? { ok: true } : data);
    } catch (err) {
      if (err instanceof HttpError) return errorJson(err.message, err.status);
      console.error(err);
      return errorJson("Erreur serveur", 500);
    }
  };
}

// Corps JSON d'une mutation. Un corps absent ou illisible devient un objet
// vide : c'est aux schémas zod de chaque action de refuser ce qui manque.
export async function jsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
