import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import { authenticateRequest, type ApiUser, type AuthMethod } from "@/lib/auth";

// Ossature des routes /api/admin/*.
//
// Ces routes sont appelées par le serveur de frontend-admin, et directement par
// les scripts et agents (Claude Code, MCP) munis d'un jeton d'API — jamais par
// un navigateur : pas de CORS, pas de preflight, pas de cookie. Seule
// l'authentification Bearer compte, et c'est ICI que les droits sont réellement
// appliqués — les gardes côté frontend ne servent qu'à éviter d'afficher un
// écran interdit.

// Messages de validation en français : ils remontent désormais tels quels dans
// `details` (voir parseBody), lus par des développeurs comme par l'écran
// d'import JSON.
z.config(z.locales.fr());

// Ce qui cloche dans une requête refusée, champ par champ. Sans cela, un
// appelant qui n'est pas l'écran recevait « Requête invalide » et devait
// deviner lequel de ses dix champs était en cause.
export type IssueDetail = { champ: string; message: string };

export class HttpError extends Error {
  readonly status: number;
  readonly details?: IssueDetail[];
  constructor(message: string, status = 400, details?: IssueDetail[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message: string): never {
  throw new HttpError(message, 400);
}

export function notFound(message = "Introuvable"): never {
  throw new HttpError(message, 404);
}

export type AdminContext = { user: ApiUser; auth: AuthMethod };

function errorJson(message: string, status: number, details?: IssueDetail[]) {
  return NextResponse.json(details?.length ? { error: message, details } : { error: message }, {
    status,
    // Un client HTTP ou MCP qui reçoit 401 sait ainsi quel schéma présenter.
    headers: status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined,
  });
}

// Ce que la route attend, décrit par les MÊMES schémas zod qui la valident :
// la documentation (GET /api/admin/openapi.json, outil `catalogue` du serveur
// MCP) est construite à partir d'eux, elle ne peut donc pas dériver du code.
// Chaque route passe sa description à adminRoute ; lib/api-catalog.ts les
// rassemble.
export type RouteDoc = {
  // Une ou deux phrases : à quoi sert la route, ce que renvoie la lecture.
  summary: string;
  // Paramètres d'adresse (GET, DELETE, envoi de fichier).
  query?: z.ZodType;
  // Corps JSON. Pour une route d'écran : une variante par `action`.
  body?: z.ZodType;
  // Le corps est le fichier BRUT, pas du JSON (pièces jointes).
  rawBody?: true;
};

export type RouteMeta = RouteDoc & { roles: Role[] };

// Une contrainte violée n'est pas une panne : c'est une requête qui désigne
// quelque chose d'inexistant ou de déjà pris. La laisser remonter en 500
// affichait « Erreur serveur » à l'écran, là où la personne avait seulement
// besoin de savoir ce qui clochait dans sa saisie.
function prismaError(err: unknown): { message: string; status: number } | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (err.code) {
    case "P2002":
      return { message: "Cette valeur est déjà utilisée", status: 400 };
    // P2003 couvre les DEUX sens de la contrainte : on pointe quelque chose qui
    // n'existe pas, ou on supprime quelque chose qui est encore pointé. Le
    // message ne disait que le premier, et annonçait donc « n'existe pas » à
    // propos d'un élément bien présent — incompréhensible à l'écran.
    case "P2003":
      return { message: "Élément lié introuvable, ou encore rattaché à d'autres données", status: 400 };
    case "P2025":
      return { message: "Introuvable", status: 404 };
    default:
      return null;
  }
}

// `roles` vide = toute session valide est acceptée (utilisé par /me).
export function adminRoute<C>(
  roles: Role[],
  handler: (ctx: AdminContext, request: NextRequest, routeCtx: C) => Promise<unknown>,
  doc: RouteDoc,
) {
  const route = async (request: NextRequest, routeCtx: C) => {
    let authenticated: Awaited<ReturnType<typeof authenticateRequest>>;
    try {
      authenticated = await authenticateRequest(request);
    } catch (err) {
      console.error("Échec de la vérification de session:", err);
      return errorJson("Erreur serveur", 500);
    }
    if (!authenticated) return errorJson("Non authentifié", 401);
    const { user, auth } = authenticated;
    if (roles.length > 0 && !roles.includes(user.role)) return errorJson("Accès refusé", 403);
    // Un jeton en lecture seule lit tout ce que lit son propriétaire, et
    // n'écrit rien : seule la méthode compte, toutes les écritures de l'API
    // sont des POST ou des DELETE.
    if (auth.via === "token" && auth.readOnly && request.method !== "GET") {
      return errorJson("Ce jeton d'API est en lecture seule", 403);
    }

    try {
      const data = await handler({ user, auth }, request, routeCtx);
      // Une mutation qui ne renvoie rien répond `{ ok: true }` : le frontend
      // n'a besoin que de savoir que c'est passé.
      return NextResponse.json(data === undefined ? { ok: true } : data);
    } catch (err) {
      if (err instanceof HttpError) return errorJson(err.message, err.status, err.details);
      const known = prismaError(err);
      if (known) return errorJson(known.message, known.status);
      console.error(err);
      return errorJson("Erreur serveur", 500);
    }
  };
  // La description voyage avec le gestionnaire exporté : route.ts ne peut
  // exporter que GET, POST… et le catalogue lit `GET.meta`, `POST.meta`.
  const meta: RouteMeta = { ...doc, roles };
  return Object.assign(route, { meta });
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

// Une erreur de validation zod, champ par champ. Une action absente ou
// inconnue dit quelles actions la route connaît : c'est la première chose
// qu'un appelant qui découvre l'API a besoin de savoir.
function describeIssues(issues: z.core.$ZodIssue[]): IssueDetail[] {
  return issues.map((issue) => {
    const champ = issue.path.map(String).join(".") || "(racine)";
    const options = (issue as { options?: unknown[] }).options;
    if (issue.code === "invalid_union" && "discriminator" in issue && Array.isArray(options)) {
      return {
        champ,
        message: `Action absente ou inconnue. Actions possibles : ${options.join(", ")}`,
      };
    }
    return { champ, message: issue.message };
  });
}

// Lit et valide le corps JSON d'une requête. `message` reste le libellé
// affiché par l'écran ; le détail part à côté, dans `details`.
export async function parseBody<S extends z.ZodType>(
  schema: S,
  request: NextRequest,
  message = "Requête invalide",
): Promise<z.output<S>> {
  const parsed = schema.safeParse(await jsonBody(request));
  if (!parsed.success) throw new HttpError(message, 400, describeIssues(parsed.error.issues));
  return parsed.data;
}

// Lit et valide les paramètres d'adresse. Un paramètre répété
// (`weekday=1&weekday=2`) arrive en tableau, un paramètre seul en chaîne : le
// schéma décide de ce qu'il accepte (voir `repeated`).
export function parseQuery<S extends z.ZodType>(
  schema: S,
  request: NextRequest,
  message = "Paramètres invalides",
): z.output<S> {
  const params = request.nextUrl.searchParams;
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(message, 400, describeIssues(parsed.error.issues));
  return parsed.data;
}

// Paramètre d'adresse répétable (`weekday=…&weekday=…`) : une seule valeur
// arrive en chaîne, plusieurs en tableau ; les deux deviennent un tableau,
// validé par `arraySchema`. Requis tant qu'on n'y ajoute pas `.optional()`.
export function repeated<T extends z.ZodType<unknown, string[]>>(arraySchema: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .pipe(arraySchema);
}

// Paramètre d'adresse qui accepte une liste séparée par des virgules
// (`status=A_FAIRE,EN_COURS`) — ou répétée, comme l'envoie un formulaire.
export function commaList(description: string) {
  return z
    .preprocess(
      (value) =>
        (Array.isArray(value) ? value : value === undefined ? [] : [value])
          .flatMap((v) => String(v).split(","))
          .map((v) => v.trim())
          .filter(Boolean),
      z.array(z.string()),
    )
    .describe(description);
}
