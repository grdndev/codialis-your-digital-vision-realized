"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

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

// Fait passer la tâche à l'étape suivante ; c'est le backend qui connaît
// l'enchaînement des statuts et refuse d'avancer une tâche déjà terminée.
export async function advanceInternalTaskAction(taskId: string) {
  await apiPost("/api/admin/dashboard", { action: "advance-internal-task", taskId });
  revalidatePath("/dashboard");
}
