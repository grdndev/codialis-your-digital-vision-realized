"use server";

import { apiPublicPost } from "@/lib/api";

export type VerifyState = { done?: boolean; email?: string; error?: string };

// Confirme l'adresse : l'API engendre alors le mot de passe et l'envoie. Il
// n'apparaît jamais à l'écran — seule la boîte de réception le reçoit.
export async function verifyAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Lien invalide." };

  const result = await apiPublicPost<{ email?: string; alreadyVerified?: boolean }>(
    "/api/auth/verify",
    { token },
  );
  if (!result.ok) return { error: result.error };
  return { done: true, email: result.data.email };
}
