"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { Severity, TriageState } from "@/lib/types";

const TRIAGE = "/api/admin/triage";

export async function qualifyTicketAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return;

  await apiPost(TRIAGE, {
    action: "qualify",
    ticketId,
    module: String(formData.get("module") ?? "") || null,
    severity: (String(formData.get("severity") ?? "") || null) as Severity | null,
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
    estHours: parseFloat(String(formData.get("estHours") ?? "0").replace(",", ".")) || 0,
    // Champ absent = le formulaire ne proposait pas de transition : l'état du
    // triage reste tel quel.
    nextState: (String(formData.get("nextState") ?? "") || null) as TriageState | null,
  });
  revalidatePath("/triage");
}

export async function reopenTriageAction(ticketId: string) {
  await apiPost(TRIAGE, { action: "reopen", ticketId });
  revalidatePath("/triage");
}

export async function addTriageReplyAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!ticketId || !body) return;

  await apiPost(TRIAGE, { action: "add-reply", ticketId, body });
  revalidatePath("/triage");
}
