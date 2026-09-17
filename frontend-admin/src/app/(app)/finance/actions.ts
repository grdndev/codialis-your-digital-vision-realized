"use server";

import { revalidatePath } from "next/cache";
import { parseNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";

export async function createInvoiceAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amount = parseNumber(formData.get("amount"));
  const dueRaw = String(formData.get("dueAt") ?? "");
  if (!projectId || !label || amount <= 0) return;

  await apiPost("/api/admin/finance", {
    action: "create-invoice",
    projectId,
    label,
    amount,
    // <input type="date"> ne donne qu'un jour : on l'envoie en ISO complet,
    // seul format que l'API accepte pour une date.
    dueAt: dueRaw ? new Date(`${dueRaw}T00:00:00.000Z`).toISOString() : null,
  });
  revalidatePath("/finance");
}

export async function markInvoicePaidAction(invoiceId: string) {
  await apiPost("/api/admin/finance", { action: "mark-paid", invoiceId });
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

export async function deleteInvoiceAction(invoiceId: string) {
  try {
    await apiPost("/api/admin/finance", { action: "delete-invoice", invoiceId });
  } catch (err) {
    if (err instanceof ApiError) redirect(`/finance?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/finance");
}
