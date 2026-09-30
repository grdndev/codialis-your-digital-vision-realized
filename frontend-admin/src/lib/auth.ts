import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { defaultPathFor } from "@/lib/nav";
import type { Role, SessionUser } from "@/lib/types";
import type { ThemeColors } from "@/lib/theme";

export { SESSION_COOKIE };

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

// Le cookie de session est `Secure` en production. Le drapeau est surchargeable
// parce qu'un navigateur refuse un cookie `Secure` servi en HTTP clair — sauf
// sur `localhost`, qu'il considère comme une origine sûre. Une pile lancée sur
// une autre machine et consultée en `http://<ip>:3002` perdrait donc le cookie,
// et la connexion boucherait sans message. `SESSION_COOKIE_SECURE=false` lève
// la contrainte pour ce cas ; ne jamais l'utiliser sur un domaine public.
function cookieSecure(): boolean {
  // Une valeur vide vaut « non défini » : c'est ce qu'attend un fichier
  // d'environnement où la clé est présente mais laissée en blanc.
  const override = process.env.SESSION_COOKIE_SECURE;
  if (override) return override !== "false";
  return process.env.NODE_ENV === "production";
}

// Le JWT est émis et signé par le backend ; frontend-admin ne connaît pas
// AUTH_SECRET et ne le vérifie donc jamais lui-même. Il le stocke, le relaie,
// et laisse le backend juger de sa validité.
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// `cache()` déduplique l'appel sur la durée d'une requête : le layout et la
// page qu'il enveloppe demandent tous les deux l'utilisateur courant, mais le
// backend n'est interrogé qu'une fois.
const getSession = cache(async (): Promise<{ user: SessionUser; theme: ThemeColors | null } | null> => {
  const store = await cookies();
  if (!store.get(SESSION_COOKIE)) return null;
  try {
    return await apiGet<{ user: SessionUser; theme: ThemeColors | null }>("/api/admin/me");
  } catch {
    return null;
  }
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return (await getSession())?.user ?? null;
});

// Couleurs choisies par la personne connectée, lues dans le même appel que
// son identité : aucune requête de plus par page.
export async function getCurrentTheme(): Promise<ThemeColors | null> {
  return (await getSession())?.theme ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Garde d'affichage : elle évite de rendre un écran que l'utilisateur n'a pas
// le droit de voir. Elle ne fait pas autorité — chaque route du backend
// revérifie le rôle de son côté, c'est lui qui protège réellement les données.
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(defaultPathFor(user.role));
  return user;
}
