"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth";

// Le backend est sans état : se déconnecter, c'est jeter le jeton côté
// frontend-admin. Il n'y a aucune session serveur à invalider.
export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
