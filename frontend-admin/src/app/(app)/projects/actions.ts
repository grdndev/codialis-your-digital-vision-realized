"use server";

import { revalidatePath } from "next/cache";
import { parseNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import type { TicketType } from "@/lib/types";

const PROJECTS = "/api/admin/projects";

// Les erreurs métier de l'ouverture d'un client ou d'un projet remontent dans
// l'URL : « ce client existe déjà » doit se lire à l'écran, pas se perdre.
function fail(message: string): never {
  redirect(`/projects?error=${encodeURIComponent(message)}`);
}

function num(fd: FormData, key: string): number {
  return parseNumber(fd.get(key));
}

export async function createClientAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  try {
    await apiPost(PROJECTS, {
      action: "create-client",
      name,
      contactName: String(formData.get("contactName") ?? "").trim() || null,
      contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
      contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/projects");
  redirect("/projects?client=1");
}

export async function createProjectAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId || !name) return;
  const deadlineAt = String(formData.get("deadlineAt") ?? "");
  const soldAmount = num(formData, "soldAmount");

  let id: string;
  try {
    const created = await apiPost<{ id: string }>(PROJECTS, {
      action: "create-project",
      clientId,
      name,
      group: String(formData.get("group") ?? "DEV"),
      phaseLabel: String(formData.get("phaseLabel") ?? "").trim(),
      hoursSold: num(formData, "hoursSold"),
      soldAmount: soldAmount > 0 ? soldAmount : null,
      deadlineAt: deadlineAt ? new Date(`${deadlineAt}T00:00:00.000Z`).toISOString() : null,
    });
    id = created.id;
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/projects");
  // On enchaîne sur la fiche : après avoir ouvert un projet, la suite est d'y
  // poser ses épics et ses tickets.
  redirect(`/projects/${id}`);
}

export async function updateProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!projectId || !name) return;
  const deadlineAt = String(formData.get("deadlineAt") ?? "");
  const openedAt = String(formData.get("openedAt") ?? "");
  const soldAmount = num(formData, "soldAmount");
  const costAmount = num(formData, "costAmount");

  try {
    await apiPost(PROJECTS, {
      action: "update-project",
      projectId,
      clientId: String(formData.get("clientId") ?? ""),
      name,
      group: String(formData.get("group") ?? "DEV"),
      phaseLabel: String(formData.get("phaseLabel") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      hoursSold: num(formData, "hoursSold"),
      soldAmount: soldAmount > 0 ? soldAmount : null,
      costAmount: costAmount > 0 ? costAmount : null,
      deadlineAt: deadlineAt ? new Date(`${deadlineAt}T00:00:00.000Z`).toISOString() : null,
      deadlineNote: String(formData.get("deadlineNote") ?? "").trim() || null,
      openedAt: new Date(`${openedAt || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).toISOString(),
    });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

// Changer la phase depuis l'en-tête du projet. Le formulaire complet reste
// dans l'onglet Fiche : ce raccourci existe parce que la phase est ce qu'on
// modifie le plus souvent, et qu'elle y était introuvable.
export async function updateProjectPhaseAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  try {
    await apiPost(PROJECTS, {
      action: "update-project-phase",
      projectId,
      group: String(formData.get("group") ?? "DEV"),
      phaseLabel: String(formData.get("phaseLabel") ?? "").trim(),
    });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

// Garantie et maintenance (CC-351). Une date vidée retire la couverture.
export async function updateProjectCoverageAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  // <input type="date"> ne donne qu'un jour : minuit UTC, comme l'échéance.
  const day = (key: string) => {
    const raw = String(formData.get(key) ?? "");
    return raw ? new Date(`${raw}T00:00:00.000Z`).toISOString() : null;
  };

  try {
    await apiPost(PROJECTS, {
      action: "update-project-coverage",
      projectId,
      warrantyEndsAt: day("warrantyEndsAt"),
      maintenanceEndsAt: day("maintenanceEndsAt"),
    });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/maintenance");
}

export async function updateClientAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId || !name) return;

  try {
    await apiPost(PROJECTS, { action: "update-client", clientId, name });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }
  revalidatePath("/projects");
  redirect("/projects?client=renomme");
}

export async function createEpicAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  if (!projectId || !title) return;

  await apiPost(PROJECTS, {
    action: "create-epic",
    projectId,
    title,
    estHours: parseNumber(formData.get("estHours")),
    leadId: String(formData.get("leadId") ?? "") || null,
    dueAt: dueAtRaw ? new Date(`${dueAtRaw}T00:00:00.000Z`).toISOString() : null,
  });
  revalidatePath(`/projects/${projectId}`);
}

// Import JSON — poser d'un coup les épics et les tickets d'un projet. Les erreurs de forme remontent telles quelles de l'API : « il manque
// un titre à la troisième entrée » est exploitable, « requête invalide » non.
export async function importProjectJsonAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const payload = String(formData.get("payload") ?? "").trim();
  if (!projectId || !payload) return;
  const ticketAssigneeId = String(formData.get("ticketAssigneeId") ?? "") || null;

  let message: string;
  try {
    const result = await apiPost<{ createdEpics: number; createdTickets: number }>(PROJECTS, {
      action: "import-json",
      projectId,
      payload,
      ticketAssigneeId,
    });
    message = `Import terminé : ${result.createdEpics} épic(s), ${result.createdTickets} ticket(s).`;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    message = err.message;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/tickets");
  redirect(`/projects/${projectId}?info=${encodeURIComponent(message)}`);
}

// Un ticket ajouté à un épic depuis la fiche projet. Il passe par la création
// de ticket ordinaire (référence, critères de départ, assigné par défaut) ; on
// reste sur la fiche, où l'on ajoute souvent plusieurs tickets d'affilée.
export async function createEpicTicketAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const epicId = String(formData.get("epicId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!projectId || !epicId || !title) return;

  try {
    await apiPost("/api/admin/tickets", {
      action: "create",
      type: (String(formData.get("type") ?? "DEV") || "DEV") as TicketType,
      title,
      description: "",
      steps: "",
      projectId,
      epicId,
      severity: null,
      devNature: null,
      estHours: parseNumber(formData.get("estHours")),
      assigneeId: String(formData.get("assigneeId") ?? "") || null,
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    redirect(`/projects/${projectId}?info=${encodeURIComponent(err.message)}`);
  }

  // L'avancement du projet est recalculé côté API : il s'affiche sur trois écrans.
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

export async function updateClientContactAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!clientId) return;

  await apiPost(PROJECTS, {
    action: "update-client-contact",
    clientId,
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
  });
  revalidatePath(`/projects/${projectId}`);
  // Le triage affiche le nom du contact client.
  revalidatePath("/triage");
}

export async function updateProjectDescriptionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  await apiPost(PROJECTS, {
    action: "update-project-description",
    projectId,
    description: String(formData.get("description") ?? "").trim(),
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function addClientQuestionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  if (!projectId || !question) return;

  await apiPost(PROJECTS, { action: "add-client-question", projectId, question });
  revalidatePath(`/projects/${projectId}`);
}

export async function markQuestionAskedAction(questionId: string, projectId: string) {
  await apiPost(PROJECTS, { action: "mark-question-asked", questionId });
  revalidatePath(`/projects/${projectId}`);
}

export async function answerClientQuestionAction(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!questionId || !answer) return;

  await apiPost(PROJECTS, { action: "answer-client-question", questionId, answer });
  revalidatePath(`/projects/${projectId}`);
}

// --- Reprendre ce qui a été saisi (CC-343) ---------------------------------
//
// L'API acceptait déjà ces corrections, aucun écran ne les appelait : un épic
// mal nommé ou une estimation à refaire restaient définitifs.

function revaliderProjet(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateEpicAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const epicId = String(formData.get("epicId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!projectId || !epicId || !title) return;

  await apiPost(PROJECTS, {
    action: "update-epic",
    epicId,
    projectId,
    title,
    objective: String(formData.get("objective") ?? "").trim() || null,
    estHours: parseNumber(formData.get("estHours")),
    leadId: String(formData.get("leadId") ?? "") || null,
    dueAt: String(formData.get("dueAt") ?? "")
      ? new Date(`${String(formData.get("dueAt"))}T09:00:00.000Z`).toISOString()
      : null,
  });
  revaliderProjet(projectId);
}

// Supprimer un épic laisse ses tickets au projet, hors épic. Une erreur de
// l'API remonte telle quelle en bandeau.
export async function deleteEpicAction(epicId: string, projectId: string): Promise<void> {
  try {
    await apiPost(PROJECTS, { action: "delete-epic", epicId, projectId });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    redirect(`/projects/${projectId}?info=${encodeURIComponent(err.message)}`);
  }
  revaliderProjet(projectId);
  revalidatePath("/tickets");
}
