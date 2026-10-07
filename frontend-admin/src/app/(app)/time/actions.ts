"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromOfficeInput, parseNumber } from "@/lib/format";
import { ApiError, apiPost } from "@/lib/api";

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

// Correction après coup d'une session de temps mesuré, depuis la fiche d'une
// tâche ou d'un ticket (`back`). Les heures saisies sont celles du bureau, à
// La Réunion. Les droits (propriétaire du temps ou chefferie) et les contrôles
// de dates appartiennent au backend : son refus revient lisible sur la fiche.
async function correctSession(back: string, projectId: string, body: Record<string, unknown>) {
  try {
    await apiPost("/api/admin/time", body);
  } catch (err) {
    if (err instanceof ApiError) redirect(`${back}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath(back);
  await repercuter(projectId);
}

function invalid(back: string, message: string): never {
  redirect(`${back}?error=${encodeURIComponent(message)}`);
}

export async function correctSessionDatesAction(
  sessionId: string,
  back: string,
  projectId: string,
  formData: FormData,
) {
  const startedAt = fromOfficeInput(formData.get("startedAt"));
  const endedAt = fromOfficeInput(formData.get("endedAt"));
  if (!startedAt || !endedAt) invalid(back, "Date ou heure illisible");
  await correctSession(back, projectId, {
    action: "correct-session-dates",
    sessionId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  });
}

export async function correctSessionHoursAction(
  sessionId: string,
  back: string,
  projectId: string,
  formData: FormData,
) {
  // Un champ vide n'est pas « 0 h » : zéro se tape.
  if (!String(formData.get("hours") ?? "").trim()) invalid(back, "Indiquez une durée");
  const hours = parseNumber(formData.get("hours"));
  if (!Number.isFinite(hours) || hours < 0) invalid(back, "Durée illisible");
  await correctSession(back, projectId, { action: "correct-session-hours", sessionId, hours });
}

export async function stopSessionAction(
  sessionId: string,
  back: string,
  projectId: string,
  formData: FormData,
) {
  const endedAt = fromOfficeInput(formData.get("endedAt"));
  if (!endedAt) invalid(back, "Date ou heure illisible");
  await correctSession(back, projectId, {
    action: "stop-session",
    sessionId,
    endedAt: endedAt.toISOString(),
    status: String(formData.get("status") ?? "A_FAIRE"),
  });
}
