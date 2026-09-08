"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { Severity, TicketType } from "@/lib/types";

// Le projet concerné n'est jamais transmis : le backend le déduit de la session
// du client, ce qui interdit d'agir sur le projet d'un autre.

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
      description: String(formData.get("description") ?? "").trim(),
      severity: type === "BUG" ? ((String(formData.get("severity") ?? "MINEUR")) as Severity) : null,
    },
    "/portal",
  );
  revalidatePath("/portal/bugs");
  // Le signalement arrive dans la file de triage de l'agence.
  revalidatePath("/triage");
}

export async function sendClientMessageAction(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await apiPost("/api/admin/client/messages", { action: "send", body }, "/portal");
  revalidatePath("/portal/messages");
}
