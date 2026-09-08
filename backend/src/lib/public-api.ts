import { NextResponse } from "next/server";

// Helpers partagés par les routes /api/* consommées par le site vitrine.
//
// Le site public est statique et hébergé séparément (Hostinger) : chaque appel
// du navigateur est donc cross-origin. Ces routes sont en lecture publique et
// ne lisent aucun cookie, il n'y a donc pas de `Allow-Credentials` — seule
// l'origine appelante est autorisée, pour ne pas ouvrir l'API à tout le web.

const DEFAULT_ORIGINS = [
  "https://codialis.com",
  "https://www.codialis.com",
  "http://localhost:3001",
];

// Réglages de page publics : cacheables côté navigateur. Le navigateur sert
// depuis son cache pendant 60 s puis rafraîchit en fond -> chargement quasi
// instantané sur visites répétées.
export const PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=300";

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Une requête sans en-tête Origin (curl, monitoring, appel serveur à serveur)
// n'a pas besoin de la moindre en-tête CORS : on ne renvoie rien.
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

export function apiJson(
  request: Request,
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...corsHeaders(request), ...init.headers },
  });
}

export function apiError(request: Request, message: string, status: number) {
  return apiJson(request, { error: message }, { status });
}

// Les POST du site envoient `Content-Type: application/json`, ce qui déclenche
// un preflight. Sans réponse à OPTIONS, le navigateur bloque l'envoi.
export function apiPreflight(request: Request, methods: string) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Le corps peut être absent ou mal formé (crawler, requête tronquée) : on
// retombe sur un objet vide plutôt que de laisser remonter une 500.
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}
