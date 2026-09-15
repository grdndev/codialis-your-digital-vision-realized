"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

const AUTOMATIONS = "/api/admin/automations";

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
