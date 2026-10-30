"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { apiPost } from "@/lib/api";
import { PORTAL_PROJECT_COOKIE } from "@/lib/client-project";
import { parseMultiline } from "@/lib/format";
import type { Severity, TicketType } from "@/lib/types";

// Le projet transmis au backend est celui de la page affichée (champ caché
// `projectId`), pas celui du cookie : un changement de projet dans un autre
// onglet n'envoie pas le message ailleurs. Ce n'est qu'une préférence, que le
// backend valide contre l'entreprise du compte connecté : impossible d'agir
// sur le projet d'un autre client (CC-374).

// Sélecteur de projet du portail. Poser le cookie suffit : Next réaffiche la
// page et son layout avec la nouvelle valeur.
export async function selectPortalProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  (await cookies()).set(PORTAL_PROJECT_COOKIE, projectId, {
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
    path: "/",
  });
}

export async function createClientTicketAction(formData: FormData) {
  const type = (String(formData.get("type") ?? "BUG") === "DEV" ? "DEV" : "BUG") as TicketType;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await apiPost(
    "/api/admin/client/bugs",
    {
      action: "create-ticket",
      type,
      title,
      description: parseMultiline(formData.get("description")),
      severity: type === "BUG" ? ((String(formData.get("severity") ?? "MINEUR")) as Severity) : null,
      project: String(formData.get("projectId") ?? "") || null,
    },
    "/portal",
  );
  revalidatePath("/portal/bugs");
  // Le signalement arrive dans la file de triage de l'agence.
  revalidatePath("/triage");
}

export async function sendClientMessageAction(formData: FormData) {
  const body = parseMultiline(formData.get("body"));
  if (!body) return;

  await apiPost(
    "/api/admin/client/messages",
    { action: "send", body, project: String(formData.get("projectId") ?? "") || null },
    "/portal",
  );
  revalidatePath("/portal/messages");
}
