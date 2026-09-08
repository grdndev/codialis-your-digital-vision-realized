"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { AbsenceMode } from "@/lib/types";

const AUTOMATIONS = "/api/admin/automations";

export async function setAbsenceModeAction(formData: FormData) {
  const mode = String(formData.get("mode") ?? "OUVERT") as AbsenceMode;
  await apiPost(AUTOMATIONS, { action: "set-absence-mode", mode });
  revalidatePath("/automations");
}

export async function toggleAbsenceEnabledAction(pmId: string) {
  await apiPost(AUTOMATIONS, { action: "toggle-absence-enabled", pmId });
  revalidatePath("/automations");
}

export async function toggleRuleModeAction(ruleId: string) {
  await apiPost(AUTOMATIONS, { action: "toggle-rule-mode", ruleId });
  revalidatePath("/automations");
}

export async function sendDraftAction(draftId: string) {
  await apiPost(AUTOMATIONS, { action: "send-draft", draftId });
  revalidatePath("/automations");
}

export async function ignoreDraftAction(draftId: string) {
  await apiPost(AUTOMATIONS, { action: "ignore-draft", draftId });
  revalidatePath("/automations");
}
