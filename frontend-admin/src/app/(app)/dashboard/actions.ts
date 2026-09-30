"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import { parseMultiline } from "@/lib/format";

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
  });
  revalidatePath("/dashboard");
}

// Objectifs du mois (CC-347), réservés à la direction — l'API le vérifie.
// L'échéance est un jour : minuit UTC, comme les autres échéances du back-office.
function goalFields(formData: FormData) {
  const dueRaw = String(formData.get("dueAt") ?? "");
  return {
    title: String(formData.get("title") ?? "").trim(),
    detail: parseMultiline(formData.get("detail")),
    dueAt: dueRaw ? new Date(`${dueRaw}T00:00:00.000Z`).toISOString() : "",
    projectId: String(formData.get("projectId") ?? "") || null,
  };
}

export async function createGoalAction(formData: FormData) {
  const fields = goalFields(formData);
  if (!fields.title || !fields.dueAt) return;
  await apiPost("/api/admin/dashboard", { action: "create-goal", ...fields });
  revalidatePath("/dashboard");
}

export async function updateGoalAction(goalId: string, formData: FormData) {
  const fields = goalFields(formData);
  if (!fields.title || !fields.dueAt) return;
  await apiPost("/api/admin/dashboard", { action: "update-goal", goalId, ...fields });
  revalidatePath("/dashboard");
}

export async function toggleGoalAction(goalId: string) {
  await apiPost("/api/admin/dashboard", { action: "toggle-goal", goalId });
  revalidatePath("/dashboard");
}

export async function deleteGoalAction(goalId: string) {
  await apiPost("/api/admin/dashboard", { action: "delete-goal", goalId });
  revalidatePath("/dashboard");
}

// Fait passer la tâche à l'étape suivante ; c'est le backend qui connaît
// l'enchaînement des statuts et refuse d'avancer une tâche déjà terminée.
export async function advanceInternalTaskAction(taskId: string) {
  await apiPost("/api/admin/dashboard", { action: "advance-internal-task", taskId });
  revalidatePath("/dashboard");
}
