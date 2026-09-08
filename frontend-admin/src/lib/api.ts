import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Client HTTP vers le backend.
//
// Topologie : le navigateur ne parle QU'À frontend-admin. C'est le serveur Next
// de frontend-admin qui appelle le backend, en relayant la session dans un
// en-tête `Authorization: Bearer`. Conséquences voulues :
//   - aucun cookie ne traverse une frontière d'origine, donc pas de
//     `SameSite=None` ni de CORS avec credentials à maintenir ;
//   - l'URL du backend n'est jamais exposée au navigateur (`BACKEND_URL` n'est
//     pas préfixé `NEXT_PUBLIC_`) ;
//   - le backend reste sans état : il vérifie une signature, il ne lit rien.

const DEFAULT_BACKEND = "http://localhost:3001";

function backendUrl(path: string): string {
  const base = (process.env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, "");
  return `${base}${path}`;
}

async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

// Levée quand le backend répond une erreur métier (400/404/409). Les appelants
// la rattrapent pour afficher un message ; 401 et 403 ne passent pas par ici,
// ils redirigent directement (voir `handle`).
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Prisma renvoyait des `Date` ; le JSON les transporte en chaînes ISO. On les
// reconstruit à la lecture pour que tout le code de page (`.getTime()`,
// `fmtDate(...)`, comparaisons) continue de fonctionner à l'identique.
// Le motif est volontairement strict — date + heure + fuseau — pour ne pas
// convertir une chaîne de texte qui ressemblerait vaguement à une date.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_TIME.test(value)) return new Date(value);
  return value;
}

async function handle<T>(res: Response, fallbackPath: string): Promise<T> {
  // Session absente, expirée ou signature invalide : on repart au login.
  if (res.status === 401) redirect("/login");
  // Le backend est seul juge des droits. Un refus renvoie l'utilisateur sur sa
  // page par défaut plutôt que d'afficher un écran vide.
  if (res.status === 403) redirect(fallbackPath);

  const text = await res.text();
  const body = text ? (JSON.parse(text, reviveDates) as Record<string, unknown>) : {};

  if (!res.ok) {
    const message = typeof body.error === "string" ? body.error : `Erreur ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

// `fallbackPath` : où renvoyer l'utilisateur sur un 403. /tickets est la page
// que tous les rôles internes peuvent voir (cf. NAV_ITEMS).
export async function apiGet<T>(path: string, fallbackPath = "/tickets"): Promise<T> {
  const token = await sessionToken();
  const res = await fetch(backendUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    // Données d'un back-office : jamais de cache, chaque écran doit refléter
    // l'état réel de la base.
    cache: "no-store",
  });
  return handle<T>(res, fallbackPath);
}

export async function apiPost<T>(path: string, body?: unknown, fallbackPath = "/tickets"): Promise<T> {
  const token = await sessionToken();
  const res = await fetch(backendUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  return handle<T>(res, fallbackPath);
}

// Connexion : le seul appel qui part sans session. Renvoie le JWT à ranger en
// cookie, ou l'erreur d'identifiants à réafficher dans le formulaire.
export async function apiLogin(
  email: string,
  password: string,
): Promise<{ ok: true; token: string; role: string } | { ok: false; error: string }> {
  const res = await fetch(backendUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as { token?: string; role?: string; error?: string }) : {};
  if (!res.ok || !body.token || !body.role) {
    return { ok: false, error: body.error ?? `Erreur ${res.status}` };
  }
  return { ok: true, token: body.token, role: body.role };
}
