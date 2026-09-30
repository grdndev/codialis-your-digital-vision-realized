"use server";

import { revalidatePath } from "next/cache";
import { parseMultiline, parseNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";

function fail(err: unknown): never {
  if (err instanceof ApiError) redirect(`/finance?error=${encodeURIComponent(err.message)}`);
  throw err;
}

// Deux sortes de facture partent du même formulaire (CC-350) : l'échéance
// suivante du projet, dont l'API fixe le libellé et le montant, ou une facture
// libre — un avenant, une prestation hors échéancier.
export async function createInvoiceAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const dueRaw = String(formData.get("dueAt") ?? "");
  // <input type="date"> ne donne qu'un jour : on l'envoie en ISO complet,
  // seul format que l'API accepte pour une date.
  const dueAt = dueRaw ? new Date(`${dueRaw}T00:00:00.000Z`).toISOString() : null;
  if (!projectId) return;

  try {
    if (formData.get("kind") === "milestone") {
      await apiPost("/api/admin/finance", { action: "create-milestone-invoice", projectId, dueAt });
    } else {
      const label = String(formData.get("label") ?? "").trim();
      const amount = parseNumber(formData.get("amount"));
      if (!label || amount <= 0) return;
      await apiPost("/api/admin/finance", { action: "create-invoice", projectId, label, amount, dueAt });
    }
  } catch (err) {
    fail(err);
  }
  revalidatePath("/finance");
}

// Taux horaire et durée d'une journée (CC-357). Saisis à la française : « 102,5 ».
export async function updateRatesAction(formData: FormData) {
  const hourlyRate = parseNumber(formData.get("hourlyRate"));
  const workdayHours = parseNumber(formData.get("workdayHours"));
  if (hourlyRate <= 0 || workdayHours <= 0) {
    redirect(`/finance?error=${encodeURIComponent("Le taux horaire et la durée d'une journée doivent être positifs")}`);
  }
  try {
    await apiPost("/api/admin/finance", { action: "update-rates", hourlyRate, workdayHours });
  } catch (err) {
    fail(err);
  }
  revalidatePath("/finance");
}

// Prix total vidé = plus de prix : le projet ne peut alors plus émettre
// d'échéance, seulement des factures libres.
export async function updateProjectBillingAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  const total = parseNumber(formData.get("total"));

  try {
    await apiPost("/api/admin/finance", {
      action: "update-project-billing",
      projectId,
      total: total > 0 ? total : null,
      plan: String(formData.get("plan") ?? ""),
    });
  } catch (err) {
    fail(err);
  }
  revalidatePath("/finance");
  revalidatePath(`/projects/${projectId}`);
}

export async function markInvoicePaidAction(invoiceId: string) {
  await apiPost("/api/admin/finance", { action: "mark-paid", invoiceId });
  revalidatePath("/finance");
}

export async function setInvoiceStatusAction(invoiceId: string, status: "EN_ATTENTE" | "EN_RETARD") {
  try {
    await apiPost("/api/admin/finance", { action: "set-invoice-status", invoiceId, status });
  } catch (err) {
    if (err instanceof ApiError) redirect(`/finance?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/finance");
}

export async function addInvoiceCommentAction(invoiceId: string, formData: FormData) {
  const body = parseMultiline(formData.get("body"));
  if (!body) return;

  await apiPost("/api/admin/finance", { action: "add-invoice-comment", invoiceId, body });
  revalidatePath("/finance");
}

export async function updateInvoiceAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amount = parseNumber(formData.get("amount"));
  if (!invoiceId || !label || amount <= 0) return;
  const dueRaw = String(formData.get("dueAt") ?? "");

  try {
    await apiPost("/api/admin/finance", {
      action: "update-invoice",
      invoiceId,
      label,
      amount,
      dueAt: dueRaw ? new Date(`${dueRaw}T00:00:00.000Z`).toISOString() : null,
    });
  } catch (err) {
    if (err instanceof ApiError) redirect(`/finance?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/finance");
}

// Le rang arrive du formulaire en texte ; vide = hors échéancier.
export async function setInvoiceMilestoneAction(invoiceId: string, formData: FormData) {
  const raw = String(formData.get("milestone") ?? "");
  try {
    await apiPost("/api/admin/finance", {
      action: "set-invoice-milestone",
      invoiceId,
      milestone: raw === "" ? null : Number(raw),
    });
  } catch (err) {
    fail(err);
  }
  revalidatePath("/finance");
}

export async function deleteInvoiceAction(invoiceId: string) {
  try {
    await apiPost("/api/admin/finance", { action: "delete-invoice", invoiceId });
  } catch (err) {
    if (err instanceof ApiError) redirect(`/finance?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/finance");
}
