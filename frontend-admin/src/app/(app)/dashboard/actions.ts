"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { InternalTaskPriority } from "@/lib/types";

export async function assignInternalTaskAction(formData: FormData) {
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  if (!assigneeId || !title) return;

  await apiPost("/api/admin/dashboard", {
    action: "assign-internal-task",
    assigneeId,
    title,
    description: String(formData.get("description") ?? "").trim(),
    dueAt: dueAtRaw ? new Date(`${dueAtRaw}T00:00:00.000Z`).toISOString() : null,
    priority: priorityOf(formData),
  });
  revalidatePath("/dashboard");
}

// Fait passer la tâche à l'étape suivante ; c'est le backend qui connaît
// l'enchaînement des statuts et refuse d'avancer une tâche déjà terminée.
export async function advanceInternalTaskAction(taskId: string) {
  await apiPost("/api/admin/dashboard", { action: "advance-internal-task", taskId });
  revalidatePath("/dashboard");
}

// Une valeur inconnue retombe sur « Normale » plutôt que d'échouer : c'est le
// défaut de la tâche, pas une erreur de saisie.
function priorityOf(formData: FormData): InternalTaskPriority {
  const value = String(formData.get("priority") ?? "");
  return value === "HAUTE" || value === "URGENTE" ? value : "NORMALE";
}

// Le contrôle des droits (qui a confié la tâche, ou la direction) appartient au
// backend : ces actions ne font que traduire le formulaire.
export async function setInternalTaskPriorityAction(taskId: string, formData: FormData) {
  await apiPost("/api/admin/dashboard", {
    action: "set-internal-task-priority",
    taskId,
    priority: priorityOf(formData),
  });
  revalidatePath("/dashboard");
}

export async function archiveInternalTaskAction(taskId: string, archived: boolean) {
  await apiPost("/api/admin/dashboard", { action: "archive-internal-task", taskId, archived });
  revalidatePath("/dashboard");
}

export async function deleteInternalTaskAction(taskId: string) {
  await apiPost("/api/admin/dashboard", { action: "delete-internal-task", taskId });
  revalidatePath("/dashboard");
}
