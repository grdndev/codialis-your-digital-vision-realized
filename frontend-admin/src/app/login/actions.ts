"use server";

import { redirect } from "next/navigation";
import { apiLogin } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { defaultPathFor } from "@/lib/nav";
import type { Role } from "@/lib/types";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Renseignez votre e-mail et votre mot de passe." };
  }

  // La vérification du mot de passe appartient au backend : c'est lui qui a la
  // base et le secret de signature. On ne reçoit qu'un jeton ou un refus.
  const result = await apiLogin(email, password);
  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.token);
  redirect(defaultPathFor(result.role as Role));
}
