"use server";

import { redirect } from "next/navigation";
import { apiPublicPost } from "@/lib/api";

export type VerifyState = { error?: string };

// Le lien d'invitation mène ici : la personne choisit son mot de passe, l'API
// le pose et confirme l'adresse du même geste. Aucun identifiant n'a jamais
// transité par e-mail.
export async function verifyAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Lien invalide." };
  // Comparaison faite ici : c'est une erreur de saisie, l'API n'a pas à
  // connaître le champ de confirmation.
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  const result = await apiPublicPost("/api/auth/verify", { token, password });
  if (!result.ok) return { error: result.error };

  redirect("/login?activated=1");
}
