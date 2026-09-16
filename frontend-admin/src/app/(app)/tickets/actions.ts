"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost } from "@/lib/api";
import type { DevNature, Severity, TaskStatus, TicketType } from "@/lib/types";

const TICKETS = "/api/admin/tickets";

export async function createTicketAction(formData: FormData) {
  const type = String(formData.get("type") ?? "BUG") as TicketType;
  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "");
  if (!title || !projectId) return;

  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "create",
    type,
    title,
    description: String(formData.get("description") ?? "").trim(),
    projectId,
    epicId: String(formData.get("epicId") ?? "") || null,
    severity: (String(formData.get("severity") ?? "") || null) as Severity | null,
    devNature: (String(formData.get("devNature") ?? "") || null) as DevNature | null,
    estHours: parseFloat(String(formData.get("estHours") ?? "0").replace(",", ".")) || 0,
    // Vide = laisser l'API décider : un développeur se voit attribuer son ticket.
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
  });

  revalidatePath("/tickets");
  redirect(`/tickets/${ref}`);
}

export async function updateTicketStatusAction(ticketId: string, transition: "advance" | "reopen") {
  // L'enchaînement des statuts est une règle métier : l'API renvoie la
  // référence du ticket touché, dont on a besoin pour revalider sa page.
  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "update-status",
    ticketId,
    transition,
  });
  revalidatePath(`/tickets/${ref}`);
  revalidatePath("/tickets");
}

// Déplacement vers une colonne précise du kanban : l'enchaînement pas à pas
// d'`updateTicketStatusAction` ne sait pas exprimer ce geste.
export async function setTicketStatusAction(ticketId: string, status: TaskStatus) {
  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "set-status",
    ticketId,
    status,
  });
  revalidatePath(`/tickets/${ref}`);
  revalidatePath("/tickets");
}

export async function updateTicketAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!ticketId || !title) return;

  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "update",
    ticketId,
    title,
    description: String(formData.get("description") ?? "").trim(),
    steps: String(formData.get("steps") ?? "").trim(),
    severity: (String(formData.get("severity") ?? "") || null) as Severity | null,
    devNature: (String(formData.get("devNature") ?? "") || null) as DevNature | null,
    estHours: parseFloat(String(formData.get("estHours") ?? "0").replace(",", ".")) || 0,
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
    epicId: String(formData.get("epicId") ?? "") || null,
  });

  revalidatePath(`/tickets/${ref}`);
  revalidatePath("/tickets");
}

export async function toggleTicketCriterionAction(criterionId: string, ref: string) {
  await apiPost(TICKETS, { action: "toggle-criterion", criterionId });
  revalidatePath(`/tickets/${ref}`);
}

export async function addTicketCriterionAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!ticketId || !label) return;

  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "add-criterion",
    ticketId,
    label,
  });
  revalidatePath(`/tickets/${ref}`);
}

export async function updateTicketCriterionAction(formData: FormData) {
  const criterionId = String(formData.get("criterionId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!criterionId || !label) return;

  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "update-criterion",
    criterionId,
    label,
  });
  revalidatePath(`/tickets/${ref}`);
}

export async function deleteTicketCriterionAction(criterionId: string) {
  const { ref } = await apiPost<{ ref: string }>(TICKETS, {
    action: "delete-criterion",
    criterionId,
  });
  revalidatePath(`/tickets/${ref}`);
}

export async function addTicketCommentAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const ref = String(formData.get("ref") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!ticketId || !body) return;

  await apiPost(TICKETS, { action: "add-comment", ticketId, body });
  revalidatePath(`/tickets/${ref}`);
}
