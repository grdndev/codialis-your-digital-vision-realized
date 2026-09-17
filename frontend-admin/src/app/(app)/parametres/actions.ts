"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";

export type ChangeState = { done?: boolean; error?: string };

const ME = "/api/admin/me";

// L'intitulé et la photo s'affichent sous le nom dans la section « équipe » du
// site vitrine : chacun rédige les siens, le rôle applicatif reste à la direction.
export async function updateProfileAction(formData: FormData) {
  await apiPost(ME, {
    action: "update-profile",
    jobTitle: String(formData.get("jobTitle") ?? "").trim() || null,
    photo: String(formData.get("photo") ?? "").trim() || null,
  });
  revalidatePath("/parametres");
}

export async function setAbsenceModeAction(formData: FormData) {
  await apiPost(ME, {
    action: "set-absence-mode",
    mode: String(formData.get("mode") ?? "OUVERT"),
  });
  revalidatePath("/parametres");
}

// Vide, le message repart au texte par défaut de l'agence : c'est la façon de
// revenir en arrière sans avoir à le recopier.
export async function setAbsenceMessageAction(formData: FormData) {
  await apiPost(ME, {
    action: "set-absence-message",
    mode: String(formData.get("mode") ?? "CONGES"),
    message: String(formData.get("message") ?? ""),
  });
  revalidatePath("/parametres");
  revalidatePath("/portal/messages");
}

export async function toggleAbsenceEnabledAction() {
  await apiPost(ME, { action: "toggle-absence-enabled" });
  revalidatePath("/parametres");
}

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

  revalidatePath("/parametres");
  return { done: true };
}

// Les horaires bornent le temps mesuré : une tâche laissée « en cours » le soir
// ne compte ni la nuit, ni le week-end, ni la pause. Les champs `time` du
// formulaire arrivent en « HH:MM », l'API compte en minutes depuis minuit —
// c'est une heure de bureau, pas un instant, aucun fuseau n'entre en jeu.
function minutesOf(value: FormDataEntryValue | null): number | null {
  const [h, m] = String(value ?? "").split(":");
  const hours = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

export async function updateScheduleAction(formData: FormData): Promise<void> {
  const weekdays = formData.getAll("weekdays").map((d) => Number(d));
  await apiPost(ME, {
    action: "update-schedule",
    startMin: minutesOf(formData.get("start")) ?? 540,
    endMin: minutesOf(formData.get("end")) ?? 1080,
    breakStartMin: minutesOf(formData.get("breakStart")),
    breakEndMin: minutesOf(formData.get("breakEnd")),
    // Sans jour coché, on ne compterait jamais rien : la semaine ouvrée reprend.
    weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5],
    overtimeStartMin: minutesOf(formData.get("overtimeStart")),
    overtimeEndMin: minutesOf(formData.get("overtimeEnd")),
  });
  revalidatePath("/parametres");
  revalidatePath("/time");
}
