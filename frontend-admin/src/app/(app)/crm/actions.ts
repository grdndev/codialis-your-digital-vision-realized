"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import type { CsvImportResult } from "./types";
import type { DealStage } from "@/lib/types";

const CRM = "/api/admin/crm";

// Les champs numériques optionnels : vide = « non renseigné », donc null, pas 0.
function optionalNum(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Ouvre le projet d'une affaire signée, et relie les deux. C'est le passage du
// commercial au suivi : on enchaîne donc sur la fiche du projet créé.
export async function convertDealToProjectAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const projectName = String(formData.get("projectName") ?? "").trim();
  if (!dealId || !projectName) return;

  let projectId: string;
  try {
    const created = await apiPost<{ projectId: string }>(CRM, {
      action: "convert-to-project",
      dealId,
      clientId: String(formData.get("clientId") ?? "") || null,
      clientName: String(formData.get("clientName") ?? "").trim(),
      projectName,
    });
    projectId = created.projectId;
  } catch (err) {
    if (err instanceof ApiError) redirect(`/crm?deal=${dealId}&error=${encodeURIComponent(err.message)}`);
    throw err;
  }

  revalidatePath("/crm");
  redirect(`/projects/${projectId}`);
}

export async function moveDealAction(dealId: string, stage: DealStage) {
  await apiPost(CRM, { action: "move", dealId, stage });
  revalidatePath("/crm");
}

export async function updateDealAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) return;

  await apiPost(CRM, {
    action: "update",
    dealId,
    contactFirst: String(formData.get("contactFirst") ?? "") || null,
    contactLast: String(formData.get("contactLast") ?? "") || null,
    contactEmail: String(formData.get("contactEmail") ?? "") || null,
    contactPhone: String(formData.get("contactPhone") ?? "") || null,
    description: String(formData.get("description") ?? ""),
    devHours: optionalNum(formData.get("devHours")),
    hourlyRate: optionalNum(formData.get("hourlyRate")),
  });
  revalidatePath("/crm");
}

export async function setLossReasonAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) return;

  await apiPost(CRM, {
    action: "set-loss-reason",
    dealId,
    lossReason: String(formData.get("lossReason") ?? "") || null,
    lossDetail: String(formData.get("lossDetail") ?? "") || null,
  });
  revalidatePath("/crm");
}

export async function addDealNoteAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!dealId || !body) return;

  await apiPost(CRM, { action: "add-note", dealId, body });
  revalidatePath("/crm");
}

export async function updateQuarterlyTargetAction(formData: FormData) {
  const value = parseFloat(String(formData.get("quarterlyTarget") ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return;

  await apiPost(CRM, { action: "update-quarterly-target", value });
  revalidatePath("/crm");
}

// L'analyse du CSV appartient au backend : c'est lui qui écrit les prospects et
// qui doit juger de ce qu'il accepte. On ne fait que lui remettre le texte.
export async function importDealsCsvAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/crm?importError=empty");
  }

  const result = await apiPost<CsvImportResult>(CRM, {
    action: "import-csv",
    csv: await file.text(),
  });

  if (result.error) redirect(`/crm?importError=${result.error}`);

  revalidatePath("/crm");
  redirect(`/crm?imported=${result.imported ?? 0}&skipped=${result.skipped ?? 0}`);
}

export async function createDealAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await apiPost(CRM, {
    action: "create",
    name,
    // Le champ est saisi en k€ ; la conversion en euros se fait côté API.
    amountK: parseFloat(String(formData.get("amount") ?? "0").replace(",", ".")) || 0,
    note: String(formData.get("note") ?? ""),
  });
  revalidatePath("/crm");
}
