"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

export async function createInvoiceAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amount = parseFloat(String(formData.get("amount") ?? "0").replace(",", ".")) || 0;
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
