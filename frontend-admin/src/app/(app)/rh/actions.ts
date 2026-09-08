"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { ShiftKind } from "@/lib/types";

const RH = "/api/admin/rh";

export async function addOvertimeAction(formData: FormData) {
  const dateRaw = String(formData.get("date") ?? "");
  const hours = parseFloat(String(formData.get("hours") ?? "0").replace(",", "."));
  if (!dateRaw || !Number.isFinite(hours) || hours <= 0) return;

  await apiPost(RH, {
    action: "add-overtime",
    date: new Date(`${dateRaw}T09:00:00.000Z`).toISOString(),
    hours,
    reason: String(formData.get("reason") ?? "").trim(),
  });
  revalidatePath("/rh");
}

export async function setPlannedShiftAction(formData: FormData) {
  const dateRaw = String(formData.get("date") ?? "");
  if (!dateRaw) return;

  await apiPost(RH, {
    action: "set-shift",
    // Minuit UTC, comme currentWeekdays() : la grille relit ses créneaux par
    // égalité exacte de date, les deux doivent désigner le même instant.
    date: new Date(dateRaw).toISOString(),
    kind: String(formData.get("kind") ?? "BUREAU") as ShiftKind,
    note: String(formData.get("note") ?? "").trim(),
  });
  revalidatePath("/rh");
}

export async function addTravelAction(formData: FormData) {
  const startRaw = String(formData.get("startDate") ?? "");
  const endRaw = String(formData.get("endDate") ?? "");
  const destination = String(formData.get("destination") ?? "").trim();
  if (!startRaw || !destination) return;

  await apiPost(RH, {
    action: "add-travel",
    startDate: new Date(`${startRaw}T09:00:00.000Z`).toISOString(),
    endDate: endRaw ? new Date(`${endRaw}T09:00:00.000Z`).toISOString() : null,
    destination,
    motif: String(formData.get("motif") ?? "").trim(),
  });
  revalidatePath("/rh");
}

export async function validateOvertimeAction(entryId: string) {
  await apiPost(RH, { action: "validate-overtime", entryId });
  revalidatePath("/rh");
}

export async function validateTravelAction(entryId: string) {
  await apiPost(RH, { action: "validate-travel", entryId });
  revalidatePath("/rh");
}
