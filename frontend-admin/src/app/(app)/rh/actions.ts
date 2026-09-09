"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { ShiftKind } from "@/lib/types";
import type { AbsenceType, HalfDay, HoursEntryKind, RecurrenceEffect, RecurrenceFreq } from "./types";

const RH = "/api/admin/rh";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function num(fd: FormData, key: string): number {
  return parseFloat(str(fd, key).replace(",", ".")) || 0;
}

// Les dates sont saisies au jour. 09:00 UTC est la convention de toutes les
// dates-sans-heure de l'application, sauf le planning — voir setPlannedShift.
function dayAt9(value: string): string {
  return new Date(`${value}T09:00:00.000Z`).toISOString();
}

// Les absences et les règles se comparent en dates civiles côté API : minuit.
function dayAtMidnight(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function optionalHalfDay(fd: FormData): HalfDay | null {
  const v = str(fd, "halfDay");
  return v === "AM" || v === "PM" ? v : null;
}

// --- Heures (supplémentaires et récupérations) -----------------------------

export async function addHoursAction(formData: FormData) {
  const date = str(formData, "date");
  const hours = num(formData, "hours");
  if (!date || hours <= 0) return;

  await apiPost(RH, {
    action: "add-hours",
    kind: (str(formData, "kind") || "SUP") as HoursEntryKind,
    date: dayAt9(date),
    hours,
    reason: str(formData, "reason"),
    // Vide = pour soi. Seule la direction peut saisir pour quelqu'un d'autre.
    userId: str(formData, "userId") || null,
  });
  revalidatePath("/rh");
}

// La direction tranche : validé ou refusé, et pour une heure sup, payée (paie)
// ou mise en récup.
export async function decideHoursAction(entryId: string, status: "VALIDE" | "REFUSE", paid: boolean) {
  await apiPost(RH, { action: "decide-hours", entryId, status, paid });
  revalidatePath("/rh");
}

export async function deleteHoursAction(entryId: string) {
  await apiPost(RH, { action: "delete-hours", entryId });
  revalidatePath("/rh");
}

// --- Absences ---------------------------------------------------------------

export async function addAbsenceAction(formData: FormData) {
  const start = str(formData, "startDate");
  if (!start) return;
  // Sans date de fin, l'absence tient sur la seule journée de début.
  const end = str(formData, "endDate") || start;

  await apiPost(RH, {
    action: "add-absence",
    type: (str(formData, "type") || "CONGE") as AbsenceType,
    startDate: dayAtMidnight(start),
    endDate: dayAtMidnight(end),
    halfDay: optionalHalfDay(formData),
    motif: str(formData, "motif"),
    // Une demande non payée ne décompte rien : utile quand le solde est épuisé.
    paid: formData.get("unpaid") !== "on",
    userId: str(formData, "userId") || null,
  });
  revalidatePath("/rh");
}

export async function decideAbsenceAction(
  absenceId: string,
  status: "VALIDE" | "REFUSE",
  paid: boolean,
) {
  await apiPost(RH, { action: "decide-absence", absenceId, status, paid });
  revalidatePath("/rh");
}

export async function deleteAbsenceAction(absenceId: string) {
  await apiPost(RH, { action: "delete-absence", absenceId });
  revalidatePath("/rh");
}

// --- Planning ---------------------------------------------------------------

export async function setPlannedShiftAction(formData: FormData) {
  const date = str(formData, "date");
  if (!date) return;

  await apiPost(RH, {
    action: "set-shift",
    // Minuit UTC, comme currentWeekdays() : la grille relit ses créneaux par
    // égalité exacte de date, les deux doivent désigner le même instant.
    date: new Date(date).toISOString(),
    kind: (str(formData, "kind") || "BUREAU") as ShiftKind,
    note: str(formData, "note"),
  });
  revalidatePath("/rh");
}

// --- Déplacements -----------------------------------------------------------

export async function addTravelAction(formData: FormData) {
  const start = str(formData, "startDate");
  const destination = str(formData, "destination");
  if (!start || !destination) return;
  const end = str(formData, "endDate");

  await apiPost(RH, {
    action: "add-travel",
    startDate: dayAt9(start),
    endDate: end ? dayAt9(end) : null,
    destination,
    motif: str(formData, "motif"),
  });
  revalidatePath("/rh");
}

export async function decideTravelAction(entryId: string, status: "VALIDE" | "REFUSE") {
  await apiPost(RH, { action: "decide-travel", entryId, status });
  revalidatePath("/rh");
}

// --- Règles de présence récurrentes (direction) -----------------------------

export async function addRuleAction(formData: FormData) {
  const start = str(formData, "startDate");
  if (!start) return;
  const end = str(formData, "endDate");
  const freq = (str(formData, "freq") || "WEEKLY") as RecurrenceFreq;

  // Le jour de semaine ne sert qu'aux règles hebdomadaires et bimensuelles, le
  // jour du mois qu'aux mensuelles. C'est l'API qui refuse une règle incomplète.
  const weekdayRaw = str(formData, "weekday");
  const monthdayRaw = str(formData, "monthday");

  await apiPost(RH, {
    action: "add-rule",
    // « all » applique la règle à toute l'équipe.
    userId: str(formData, "userId") || "all",
    effect: (str(formData, "effect") || "PRESENT") as RecurrenceEffect,
    freq,
    weekday: freq === "WEEKLY" || freq === "BIWEEKLY" ? Number(weekdayRaw) : null,
    monthday: freq === "MONTHLY" ? Number(monthdayRaw) : null,
    halfDay: optionalHalfDay(formData),
    startDate: dayAtMidnight(start),
    endDate: end ? dayAtMidnight(end) : null,
    motif: str(formData, "motif"),
    paid: formData.get("unpaid") !== "on",
  });
  revalidatePath("/rh");
}

export async function deleteRuleAction(ruleId: string) {
  await apiPost(RH, { action: "delete-rule", ruleId });
  revalidatePath("/rh");
}

// --- Soldes (direction) -----------------------------------------------------

// La valeur saisie est le solde RÉEL du moment : l'API cale l'ancre à
// aujourd'hui et le calcul repart de là, sans double comptage.
export async function setBalancesAction(userId: string, formData: FormData) {
  const leaveRaw = str(formData, "leave");
  const hoursRaw = str(formData, "hours");
  if (!leaveRaw && !hoursRaw) return;

  await apiPost(RH, {
    action: "set-balances",
    userId,
    leave: leaveRaw ? num(formData, "leave") : null,
    hours: hoursRaw ? num(formData, "hours") : null,
  });
  revalidatePath("/rh");
}
