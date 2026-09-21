"use server";

import { revalidatePath } from "next/cache";
import { parseNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import type { TaskStatus } from "@/lib/types";

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
  // poser ses lots et ses tâches.
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

// Import JSON — poser d'un coup les lots, leurs tâches et les tickets d'un
// projet. Les erreurs de forme remontent telles quelles de l'API : « il manque
// un titre à la troisième entrée » est exploitable, « requête invalide » non.
export async function importProjectJsonAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const payload = String(formData.get("payload") ?? "").trim();
  if (!projectId || !payload) return;

  let message: string;
  try {
    const result = await apiPost<{
      createdEpics: number;
      createdTasks: number;
      createdTickets: number;
    }>(PROJECTS, { action: "import-json", projectId, payload });
    message = `Import terminé : ${result.createdEpics} lot(s), ${result.createdTasks} tâche(s), ${result.createdTickets} ticket(s).`;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    message = err.message;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/tickets");
  redirect(`/projects/${projectId}?info=${encodeURIComponent(message)}`);
}

export async function createTaskAction(formData: FormData) {
  const epicId = String(formData.get("epicId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!epicId || !title) return;

  await apiPost(PROJECTS, {
    action: "create-task",
    epicId,
    projectId,
    title,
    estHours: parseNumber(formData.get("estHours")),
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
  });

  // L'avancement du projet est recalculé côté API : il s'affiche sur trois écrans.
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

// Un statut visé, pas seulement l'étape suivante : on doit pouvoir reculer,
// ne serait-ce que pour arrêter une tâche sans la déclarer livrée. L'API
// renvoie parfois un message — le temps compté pour quelqu'un d'autre, une
// tâche sans assigné : il repart en query pour être affiché après le
// rechargement, les formulaires de cet écran étant rendus côté serveur.
export async function setTaskStatusAction(taskId: string, projectId: string, status: TaskStatus) {
  const { notice } = await apiPost<{ notice?: string }>(PROJECTS, {
    action: "update-task-status",
    taskId,
    projectId,
    status,
  });

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/time");
  revalidatePath("/portal");

  if (notice) {
    redirect(
      `/projects/${projectId}/tasks/${taskId}?info=${encodeURIComponent(notice)}`,
    );
  }
}

export async function updateTaskStatusAction(
  taskId: string,
  projectId: string,
  transition: "advance" | "reopen",
) {
  await apiPost(PROJECTS, { action: "update-task-status", taskId, projectId, transition });

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  // Le client suit cet avancement depuis son portail.
  revalidatePath("/portal");
}

export async function toggleTaskCriterionAction(
  criterionId: string,
  projectId: string,
  taskId: string,
) {
  await apiPost(PROJECTS, { action: "toggle-task-criterion", criterionId });
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

export async function addTaskCommentAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!taskId || !body) return;

  await apiPost(PROJECTS, { action: "add-task-comment", taskId, body });
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
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
// L'API acceptait déjà ces corrections, aucun écran ne les appelait : un lot
// mal nommé, une estimation à refaire ou une tâche créée en double restaient
// définitifs.

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

// Un lot qui porte encore des tâches n'est pas supprimable : l'API refuse, et
// le message remonte tel quel plutôt que de faire disparaître le travail.
export async function deleteEpicAction(epicId: string, projectId: string): Promise<void> {
  try {
    await apiPost(PROJECTS, { action: "delete-epic", epicId, projectId });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    redirect(`/projects/${projectId}?info=${encodeURIComponent(err.message)}`);
  }
  revaliderProjet(projectId);
}

export async function updateTaskCriterionAction(formData: FormData) {
  const criterionId = String(formData.get("criterionId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!criterionId || !label) return;

  await apiPost(PROJECTS, { action: "update-task-criterion", criterionId, label });
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

export async function deleteTaskCriterionAction(
  criterionId: string,
  projectId: string,
  taskId: string,
) {
  await apiPost(PROJECTS, { action: "delete-task-criterion", criterionId });
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

export async function addTaskCriterionAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!taskId || !label) return;

  await apiPost(PROJECTS, { action: "add-task-criterion", taskId, label });
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// Supprimer une tâche emporte ses critères, ses commentaires et ses
// chronomètres (cascade du schéma). Les heures déjà saisies à la main, elles,
// restent au projet : le travail a bien eu lieu.
export async function deleteTaskAction(taskId: string, projectId: string): Promise<void> {
  await apiPost(PROJECTS, { action: "delete-task", taskId, projectId });
  revaliderProjet(projectId);
  redirect(`/projects/${projectId}`);
}

// Modifier une tâche. Changer d'assigné pendant qu'elle est « en cours »
// arrête le chronomètre du précédent et la ramène à « À faire » : l'API le
// fait et le dit, on relaie son message.
export async function updateTaskAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!taskId || !projectId || !title) return;

  const { notice } = await apiPost<{ notice?: string }>(PROJECTS, {
    action: "update-task",
    taskId,
    projectId,
    epicId: String(formData.get("epicId") ?? ""),
    title,
    description: String(formData.get("description") ?? "").trim(),
    estHours: parseNumber(formData.get("estHours")),
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
    dueAt: String(formData.get("dueAt") ?? "")
      ? new Date(`${String(formData.get("dueAt"))}T09:00:00.000Z`).toISOString()
      : null,
  });

  revaliderProjet(projectId);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  revalidatePath("/time");
  if (notice) {
    redirect(`/projects/${projectId}/tasks/${taskId}?info=${encodeURIComponent(notice)}`);
  }
}
