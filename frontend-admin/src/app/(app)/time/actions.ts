"use server";

import { revalidatePath } from "next/cache";
import { parseNumber } from "@/lib/format";
import { apiPost } from "@/lib/api";

export async function addTimeEntryAction(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const hours = parseNumber(formData.get("hours"));
  if (!label || !dateRaw || hours <= 0) return;

  // Le select « Rattaché à » encode sa cible en `task:<id>` / `ticket:<id>`.
  const [linkKind, linkId] = String(formData.get("linkedTo") ?? "").split(":");

  // Les heures sont saisies à la journée : 09:00 UTC est la convention de
  // toutes les dates-sans-heure de l'app.
  const { projectId } = await apiPost<{ projectId: string | null }>("/api/admin/time", {
    action: "add-entry",
    projectId: String(formData.get("projectId") ?? "") || null,
    taskId: linkKind === "task" ? linkId : null,
    ticketId: linkKind === "ticket" ? linkId : null,
    label,
    date: new Date(`${dateRaw}T09:00:00.000Z`).toISOString(),
    hours,
    billable: formData.get("billable") === "on",
  });

  // Ces heures remontent dans les compteurs de plusieurs écrans.
  revalidatePath("/time");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/finance");
  revalidatePath("/maintenance");
  revalidatePath("/tickets");
  // Le projet imputé est celui que le backend a retenu (une tâche ou un ticket
  // rattaché l'emporte sur le select), pas celui posté.
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (linkKind === "task" && projectId) revalidatePath(`/projects/${projectId}/tasks/${linkId}`);
  if (linkKind === "ticket") revalidatePath(`/tickets/${linkId}`);
}

// Corriger ou retirer une saisie. Le rattachement (projet, tâche, ticket) ne
// bouge pas : il fait autorité sur les compteurs, le changer reviendrait à
// déplacer des heures d'un projet à l'autre en douce. Pour cela, on supprime
// et on ressaisit.
async function repercuter(projectId: string | null) {
  revalidatePath("/time");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/finance");
  revalidatePath("/maintenance");
  revalidatePath("/tickets");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function updateTimeEntryAction(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const hours = parseNumber(formData.get("hours"));
  if (!entryId || !label || !dateRaw || hours <= 0) return;

  const { projectId } = await apiPost<{ projectId: string | null }>("/api/admin/time", {
    action: "update-entry",
    entryId,
    label,
    date: new Date(`${dateRaw}T09:00:00.000Z`).toISOString(),
    hours,
    billable: formData.get("billable") === "on",
  });
  await repercuter(projectId);
}

export async function deleteTimeEntryAction(entryId: string) {
  const { projectId } = await apiPost<{ projectId: string | null }>("/api/admin/time", {
    action: "delete-entry",
    entryId,
  });
  await repercuter(projectId);
}
