import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { defaultPathFor } from "@/lib/nav";
import type { Role, SessionUser } from "@/lib/types";

export { SESSION_COOKIE };

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

// Le JWT est émis et signé par le backend ; frontend-admin ne connaît pas
// AUTH_SECRET et ne le vérifie donc jamais lui-même. Il le stocke, le relaie,
// et laisse le backend juger de sa validité.
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  if (!store.get(SESSION_COOKIE)) return null;
  try {
    const { user } = await apiGet<{ user: SessionUser }>("/api/admin/me");
    return user;
  } catch {
    return null;
  }
});

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
