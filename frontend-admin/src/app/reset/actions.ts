"use server";

import { redirect } from "next/navigation";
import { apiPublicPost } from "@/lib/api";

export type ForgotState = { sent?: boolean; error?: string };
export type ResetState = { error?: string };

// Le formulaire « mot de passe oublié » : l'API répond toujours 200, quoi qu'il
// arrive, pour ne pas révéler si l'adresse existe. On affiche donc le même
// message dans tous les cas.
export async function forgotAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Renseignez votre adresse e-mail." };

  const result = await apiPublicPost("/api/auth/forgot", { email });
  if (!result.ok) return { error: result.error };
  return { sent: true };
}

export async function resetAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Lien invalide." };
  // Comparaison faite ici : c'est une erreur de saisie, l'API n'a pas à
  // connaître le champ de confirmation.
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  const result = await apiPublicPost("/api/auth/reset", { token, password });
  if (!result.ok) return { error: result.error };

  redirect("/login?reset=1");
}
