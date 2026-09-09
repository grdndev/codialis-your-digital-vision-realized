"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import type { Role } from "@/lib/types";

const ACCOUNTS = "/api/admin/accounts";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

// Les erreurs métier remontent dans l'URL : créer un compte peut échouer pour
// des raisons qu'il faut montrer (adresse déjà prise, e-mail non parti).
function fail(message: string): never {
  redirect(`/equipe?error=${encodeURIComponent(message)}`);
}

export async function createAccountAction(formData: FormData) {
  const name = str(formData, "name");
  const email = str(formData, "email");
  if (!name || !email) return;
  const role = (str(formData, "role") || "DEV") as Role;

  try {
    await apiPost(ACCOUNTS, {
      action: "create",
      name,
      email,
      role,
      jobTitle: str(formData, "jobTitle") || null,
      clientId: str(formData, "clientId") || null,
    });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/equipe");
  redirect("/equipe?created=1");
}

export async function updateAccountAction(userId: string, formData: FormData) {
  const name = str(formData, "name");
  const email = str(formData, "email");
  if (!name || !email) return;
  const role = (str(formData, "role") || "DEV") as Role;

  try {
    await apiPost(ACCOUNTS, {
      action: "update",
      userId,
      name,
      email,
      role,
      jobTitle: str(formData, "jobTitle") || null,
      photo: str(formData, "photo") || null,
      clientId: str(formData, "clientId") || null,
    });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }

  revalidatePath("/equipe");
  // L'intitulé et la photo sont publiés sur le site vitrine.
  revalidatePath("/site");
  redirect("/equipe?saved=1");
}

export async function deleteAccountAction(userId: string) {
  try {
    await apiPost(ACCOUNTS, { action: "delete", userId });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }
  revalidatePath("/equipe");
  redirect("/equipe?deleted=1");
}

export async function resendVerifyAction(userId: string) {
  try {
    await apiPost(ACCOUNTS, { action: "resend-verify", userId });
  } catch (err) {
    if (err instanceof ApiError) fail(err.message);
    throw err;
  }
  revalidatePath("/equipe");
  redirect("/equipe?resent=1");
}
