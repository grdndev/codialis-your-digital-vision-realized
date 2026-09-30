"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { parseMultiline } from "@/lib/format";

// Objectifs (CC-347, CC-356), réservés à la direction — l'API le vérifie.
// Toutes les écritures passent par la route de l'écran Objectifs, y compris
// celles du bloc du Dashboard : les deux écrans sont revalidés.
const OBJECTIFS = "/api/admin/objectifs";

async function send(body: Record<string, unknown>) {
  try {
    await apiPost(OBJECTIFS, body);
  } catch (err) {
    if (err instanceof ApiError) redirect(`/objectifs?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/objectifs");
  revalidatePath("/dashboard");
}

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
  await send({ action: "create-goal", ...fields });
}

export async function updateGoalAction(goalId: string, formData: FormData) {
  const fields = goalFields(formData);
  if (!fields.title || !fields.dueAt) return;
  await send({ action: "update-goal", goalId, ...fields });
}

export async function closeGoalAction(goalId: string, outcome: "ATTEINT" | "NON_ATTEINT", formData: FormData) {
  await send({ action: "close-goal", goalId, outcome, note: parseMultiline(formData.get("note")) });
}

export async function reopenGoalAction(goalId: string) {
  await send({ action: "reopen-goal", goalId });
}

export async function deleteGoalAction(goalId: string) {
  await send({ action: "delete-goal", goalId });
}
