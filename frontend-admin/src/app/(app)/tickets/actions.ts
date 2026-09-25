"use server";

import { revalidatePath } from "next/cache";
import { parseNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { ApiError, apiDelete, apiPost, apiUpload } from "@/lib/api";
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
    steps: String(formData.get("steps") ?? "").trim(),
    projectId,
    epicId: String(formData.get("epicId") ?? "") || null,
    severity: (String(formData.get("severity") ?? "") || null) as Severity | null,
    devNature: (String(formData.get("devNature") ?? "") || null) as DevNature | null,
    estHours: parseNumber(formData.get("estHours")),
    // Vide = laisser l'API décider : un développeur se voit attribuer son ticket.
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
  });

  revalidatePath("/tickets");

  // Venu d'un projet, on y reste : le formulaire se rouvre vide sur le même
  // projet, avec la référence qui vient d'être créée en bandeau. Signaler un
  // deuxième bug ne demande plus de revenir au projet puis de rouvrir le
  // formulaire. Depuis l'écran Tickets, on va au contraire sur le ticket créé,
  // c'est ce qu'on attend d'une création à l'unité.
  const depuisProjet = String(formData.get("fromProject") ?? "");
  if (depuisProjet) {
    revalidatePath(`/projects/${depuisProjet}`);
    redirect(`/tickets/new?project=${encodeURIComponent(depuisProjet)}&cree=${encodeURIComponent(ref)}`);
  }
  redirect(`/tickets/${ref}`);
}

// Déplacement vers une colonne précise, depuis le kanban comme depuis la fiche.
// Reculer est permis : arrêter un ticket ne doit pas obliger à le déclarer
// livré — et c'est ce qui coupe le chronomètre, qui tourne tant que le ticket
// est « En cours ».
//
// `notice` remonte parfois de l'API (temps compté pour l'assigné, ticket sans
// assigné). Il repart en query sur la fiche : les formulaires sont rendus côté
// serveur, il n'y a pas d'état client pour le porter. Depuis le kanban on ne
// redirige pas — le geste est un glisser-déposer entre colonnes, pas une
// navigation.
export async function setTicketStatusAction(
  ticketId: string,
  status: TaskStatus,
  showNotice = false,
) {
  const { ref, notice } = await apiPost<{ ref: string; notice?: string }>(TICKETS, {
    action: "set-status",
    ticketId,
    status,
  });
  revalidatePath(`/tickets/${ref}`);
  revalidatePath("/tickets");
  revalidatePath("/time");
  if (showNotice && notice) redirect(`/tickets/${ref}?info=${encodeURIComponent(notice)}`);
}

// Traitement en masse. Le formulaire porte une case par ticket, plus le statut
// et l'assigné à poser : une sélection, un aller-retour, au lieu d'ouvrir vingt
// fiches pour la même correction.
export async function bulkUpdateTicketsAction(formData: FormData) {
  const ticketIds = formData.getAll("ticketIds").map(String).filter(Boolean);
  if (!ticketIds.length) return;

  const status = String(formData.get("bulkStatus") ?? "");
  const assignee = String(formData.get("bulkAssignee") ?? "");

  await apiPost(TICKETS, {
    action: "bulk-update",
    ticketIds,
    status: (status || null) as TaskStatus | null,
    // « Retirer l'assigné » est un choix, pas une absence de choix : sans ce
    // drapeau, vider un assigné serait indistinct de « ne pas y toucher ».
    assigneeId: assignee && assignee !== "__aucun__" ? assignee : null,
    clearAssignee: assignee === "__aucun__",
  });

  revalidatePath("/tickets");
  revalidatePath("/time");
}

export async function updateTicketAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!ticketId || !title) return;

  const { ref, previousRef } = await apiPost<{ ref: string; previousRef?: string }>(TICKETS, {
    action: "update",
    ticketId,
    projectId: String(formData.get("projectId") ?? ""),
    type: String(formData.get("type") ?? "BUG"),
    title,
    description: String(formData.get("description") ?? "").trim(),
    steps: String(formData.get("steps") ?? "").trim(),
    severity: (String(formData.get("severity") ?? "") || null) as Severity | null,
    devNature: (String(formData.get("devNature") ?? "") || null) as DevNature | null,
    estHours: parseNumber(formData.get("estHours")),
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
    epicId: String(formData.get("epicId") ?? "") || null,
  });

  revalidatePath(`/tickets/${ref}`);
  revalidatePath("/tickets");
  // Un changement de projet renumérote le ticket : on suit la nouvelle
  // référence, l'adresse de l'ancienne ne répond plus.
  if (previousRef && previousRef !== ref) {
    revalidatePath(`/tickets/${previousRef}`);
    redirect(`/tickets/${ref}`);
  }
}

export async function toggleTicketCriterionAction(criterionId: string, ref: string) {
  await apiPost(TICKETS, { action: "toggle-criterion", criterionId });
  revalidatePath(`/tickets/${ref}`);
}

export async function deleteTicketAction(ticketId: string) {
  await apiPost(TICKETS, { action: "delete", ticketId });
  revalidatePath("/tickets");
  // La fiche n'existe plus : on repart sur la liste.
  redirect("/tickets");
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

// Pièces jointes. Le fichier arrive du navigateur dans le FormData de l'action,
// et repart au backend en binaire : frontend-admin ne fait que relayer, il ne
// connaît ni le port privé du stockage ni son jeton.
export async function addTicketAttachmentAction(ticketId: string, ref: string, formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return;

  const adresse =
    `/api/admin/attachments?kind=ticket&id=${encodeURIComponent(ticketId)}` +
    `&filename=${encodeURIComponent(fichier.name)}`;

  try {
    await apiUpload(adresse, await fichier.arrayBuffer());
  } catch (err) {
    if (err instanceof ApiError) redirect(`/tickets/${ref}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }

  revalidatePath(`/tickets/${ref}`);
}

export async function removeTicketAttachmentAction(ref: string, attachmentId: string) {
  try {
    await apiDelete(`/api/admin/attachments?attachmentId=${encodeURIComponent(attachmentId)}`);
  } catch (err) {
    if (err instanceof ApiError) redirect(`/tickets/${ref}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath(`/tickets/${ref}`);
}
