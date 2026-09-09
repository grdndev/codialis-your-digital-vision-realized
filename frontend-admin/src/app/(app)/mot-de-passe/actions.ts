"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";

export type ChangeState = { done?: boolean; error?: string };

export async function changePasswordAction(
  _prev: ChangeState,
  formData: FormData,
): Promise<ChangeState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!currentPassword || !newPassword) return { error: "Tous les champs sont requis." };
  if (newPassword !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  try {
    // L'API renvoie un jeton frais : celui en cours porte peut-être encore
    // l'obligation de changer de mot de passe.
    const { token } = await apiPost<{ token: string }>("/api/auth/change-password", {
      currentPassword,
      newPassword,
    });
    await setSessionCookie(token);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  revalidatePath("/mot-de-passe");
  return { done: true };
}
