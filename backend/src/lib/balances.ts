import "server-only";
import { prisma } from "@/lib/prisma";
import { isoOf, leaveDaysInRange, monthsBetweenIso, todayIso } from "@/lib/work-calendar";

// Soldes de congés et d'heures — calculés à la demande, jamais stockés en cumul.
//
// Le principe est celui de l'ancien backend, conservé tel quel : la direction
// saisit un solde RÉEL à un instant donné, et ce jour devient l'ANCRE. Tout ce
// qui précède l'ancre est déjà compris dans le chiffre saisi et ne doit donc
// plus être recompté — c'est ce qui permet de corriger un solde sans rejouer
// l'historique.
//
// Un solde ne doit JAMAIS pouvoir passer sous zéro. Les demandes en attente
// réservent déjà leur montant : sans cela on pourrait empiler trois congés qui,
// pris séparément, tiennent dans le solde, mais pas cumulés.
//
// Le calendrier ouvré (fériés, jours travaillés) est dans work-calendar.ts.

export { isoOf, leaveDaysInRange } from "@/lib/work-calendar";

const LEAVE_ACCRUAL_PER_MONTH = 2.5;
// Tolérance flottante : un centième d'heure ou de jour.
const EPSILON = 0.001;

export type Balance = { defined: boolean; available: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Heures sup / récupérations --------------------------------------------
//
// disponible = solde ancré + heures sup non refusées et NON PAYÉES
//            − récupérations non refusées
//
// Les écritures en attente comptent dès leur saisie, pour que le planning
// montre un disponible déjà décompté. Une heure sup payée est rémunérée : elle
// n'alimente pas le solde de récup.
export async function availableHours(userId: string, excludeId: string | null = null): Promise<Balance> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hoursBalance: true, hoursAnchor: true },
  });
  if (!user) return { defined: false, available: 0 };

  const base = user.hoursBalance ?? 0;
  // L'ancre peut être absente : le solde saisi vaut alors depuis toujours.
  const anchor = user.hoursAnchor ? isoOf(user.hoursAnchor) : null;

  const entries = await prisma.hoursEntry.findMany({
    where: { userId, status: { not: "REFUSE" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { kind: true, paid: true, hours: true, date: true },
  });

  let available = base;
  for (const e of entries) {
    if (anchor && isoOf(e.date) <= anchor) continue;
    if (e.kind === "SUP") {
      if (!e.paid) available += e.hours;
    } else {
      available -= e.hours;
    }
  }
  return { defined: true, available: round2(available) };
}

export async function canSpendHours(
  userId: string,
  hours: number,
  excludeId: string | null = null,
): Promise<boolean> {
  const { available } = await availableHours(userId, excludeId);
  return hours <= available + EPSILON;
}

// --- Congés ----------------------------------------------------------------
//
// base       = solde saisi + 2,5 j par mois complet depuis l'ancre
// consommé   = jours ouvrés des congés/absences PAYÉS non refusés posés après
//              l'ancre, plus les règles récurrentes « quotidiennes » payées
// disponible = base − consommé
//
// Non défini tant que la direction n'a pas saisi de solde ET d'ancre : sans
// point de départ il n'y a rien à décompter, et l'app refuse alors la pose d'un
// congé payé plutôt que d'autoriser un solde imaginaire.
export async function availableLeave(
  userId: string,
  excludeAbsenceId: string | null = null,
): Promise<Balance> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leaveBalance: true, leaveAnchor: true },
  });
  if (!user || user.leaveBalance === null || !user.leaveAnchor) {
    return { defined: false, available: 0 };
  }

  const anchor = isoOf(user.leaveAnchor);
  const today = todayIso();
  let available = user.leaveBalance + monthsBetweenIso(anchor, today) * LEAVE_ACCRUAL_PER_MONTH;

  const absences = await prisma.absence.findMany({
    where: {
      userId,
      status: { not: "REFUSE" },
      paid: true,
      type: { in: ["CONGE", "ABSENCE"] },
      ...(excludeAbsenceId ? { id: { not: excludeAbsenceId } } : {}),
    },
    select: { startDate: true, endDate: true, halfDay: true },
  });
  for (const a of absences) {
    available -= leaveDaysInRange(isoOf(a.startDate), isoOf(a.endDate), a.halfDay !== null, anchor);
  }

  const rules = await prisma.presenceRecurrence.findMany({
    where: { userId, freq: "DAILY", paid: true, effect: { in: ["CONGE", "ABSENCE"] } },
    select: { startDate: true, endDate: true, halfDay: true },
  });
  for (const r of rules) {
    // Une règle sans fin est bornée à aujourd'hui : sinon on décompterait un
    // futur infini. Une règle avec fin réserve son solde en entier, y compris
    // pour des jours à venir — comme une demande d'absence.
    const start = isoOf(r.startDate);
    const end = r.endDate ? isoOf(r.endDate) : today;
    if (start > end) continue;
    available -= leaveDaysInRange(start, end, r.halfDay !== null, anchor);
  }

  return { defined: true, available: round2(available) };
}

export type LeaveCheck = { ok: boolean; available?: number; cost?: number; reason?: string };

// Un congé sur [startIso..endIso] est-il posable sans passer sous zéro ?
//
// Seuls les congés et absences PAYÉS décomptent : un télétravail, une formation
// ou une absence non payée passent toujours. Sans solde défini, la pose d'un
// congé payé est refusée — il n'y a rien à décompter, et laisser passer
// donnerait un solde négatif silencieux.
export async function canPostLeave(
  userId: string,
  opts: {
    type: "TELETRAVAIL" | "CONGE" | "ABSENCE" | "FORMATION";
    paid: boolean;
    startIso: string;
    endIso: string;
    halfDay: boolean;
    excludeAbsenceId?: string | null;
  },
): Promise<LeaveCheck> {
  const decrements = opts.paid && (opts.type === "CONGE" || opts.type === "ABSENCE");
  if (!decrements) return { ok: true };

  const { defined, available } = await availableLeave(userId, opts.excludeAbsenceId ?? null);
  if (!defined) {
    return {
      ok: false,
      reason: "Solde de congés non défini : la direction doit le définir avant toute pose.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leaveAnchor: true },
  });
  const anchor = user?.leaveAnchor ? isoOf(user.leaveAnchor) : null;
  const cost = leaveDaysInRange(opts.startIso, opts.endIso, opts.halfDay, anchor);

  if (cost > available + EPSILON) {
    return {
      ok: false,
      available,
      cost,
      reason: `Solde de congés insuffisant : ${cost} j demandé(s) pour ${available} j disponible(s).`,
    };
  }
  return { ok: true, available, cost };
}
