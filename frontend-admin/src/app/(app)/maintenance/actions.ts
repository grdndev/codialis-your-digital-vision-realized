"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

// Le formulaire saisit des montants avec une virgule décimale : on normalise
// ici, l'API n'accepte que des nombres JSON.
function num(value: FormDataEntryValue | null): number {
  return parseFloat(String(value ?? "0").replace(",", ".")) || 0;
}

export async function startMaintenanceContractAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const monthlyPrice = num(formData.get("monthlyPrice"));
  const includedHours = num(formData.get("includedHours"));
  if (!projectId || monthlyPrice <= 0) return;

  await apiPost("/api/admin/maintenance", {
    action: "start-contract",
    projectId,
    monthlyPrice,
    includedHours,
  });
  revalidatePath("/maintenance");
  revalidatePath("/projects");
}
