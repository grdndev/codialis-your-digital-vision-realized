"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

const PROJECTS = "/api/admin/projects";

export async function createEpicAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  if (!projectId || !title) return;

  await apiPost(PROJECTS, {
    action: "create-epic",
    projectId,
    title,
    estHours: parseFloat(String(formData.get("estHours") ?? "0").replace(",", ".")) || 0,
    leadId: String(formData.get("leadId") ?? "") || null,
    dueAt: dueAtRaw ? new Date(`${dueAtRaw}T00:00:00.000Z`).toISOString() : null,
  });
  revalidatePath(`/projects/${projectId}`);
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
    estHours: parseFloat(String(formData.get("estHours") ?? "0").replace(",", ".")) || 0,
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
  });

  // L'avancement du projet est recalculé côté API : il s'affiche sur trois écrans.
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
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
