import { z } from "zod";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import {
  absenceDetails,
  hoursDetails,
  notifyRequestCreated,
  notifyRequestDecided,
  travelDetails,
} from "@/lib/notify";
import {
  availableHours,
  availableLeave,
  canPostLeave,
  canSpendHours,
  isoOf,
  leaveDaysInRange,
} from "@/lib/balances";

export const dynamic = "force-dynamic";

// Écran « RH » — heures (sup et récup), absences, planning, déplacements,
// règles de présence récurrentes, et les soldes qui vont avec.
//
// Les bornes de période sont fournies par l'appelant plutôt que recalculées
// ici, et c'est délibéré : la grille du planning retrouve chaque créneau par
// égalité EXACTE de date. Si le backend recalculait « la semaine courante » de
// son côté, le moindre décalage (fuseau, minuit franchi entre les deux calculs)
// ferait disparaître un créneau de sa propre case. Un seul endroit décide ce
// qu'est « cette semaine » : l'écran.

const isoDateTime = z.string().datetime();

const querySchema = z.object({
  monthStart: isoDateTime,
  monthEnd: isoDateTime,
  weekdays: z.array(isoDateTime).min(1).max(7),
});

// Une saisie est toujours pour soi, sauf la direction qui peut saisir pour un
// membre de l'équipe (planification). Jamais l'inverse.
function targetUserId(
  actor: { id: string; role: string },
  requested?: string | null,
): string {
  if (!requested || requested === actor.id) return actor.id;
  if (actor.role !== "DIR")
    badRequest("Saisie pour un autre membre réservée à la direction");
  return requested;
}

export const GET = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const params = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      monthStart: params.get("monthStart"),
      monthEnd: params.get("monthEnd"),
      weekdays: params.getAll("weekday"),
    });
    if (!parsed.success) badRequest("Période invalide");

    const monthStart = new Date(parsed.data.monthStart);
    const monthEnd = new Date(parsed.data.monthEnd);
    const weekdays = parsed.data.weekdays.map((d) => new Date(d));

    const [
      myHours,
      myShifts,
      myTravel,
      myAbsences,
      myRules,
      hoursBalance,
      leaveBalance,
    ] = await Promise.all([
      prisma.hoursEntry.findMany({
        where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: "desc" },
      }),
      prisma.plannedShift.findMany({
        where: { userId: user.id, date: { in: weekdays } },
      }),
      prisma.travelEntry.findMany({
        where: { userId: user.id },
        orderBy: { startDate: "desc" },
      }),
      // Les absences ne sont pas bornées au mois : une demande à venir doit
      // rester visible, c'est là qu'on l'annule.
      prisma.absence.findMany({
        where: { userId: user.id },
        orderBy: { startDate: "desc" },
      }),
      prisma.presenceRecurrence.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      availableHours(user.id),
      availableLeave(user.id),
    ]);

    const mine = {
      myHours,
      myShifts,
      myTravel,
      myAbsences,
      myRules,
      balances: { hours: hoursBalance, leave: leaveBalance },
    };

    // La synthèse d'équipe, la file de validation et les soldes des autres sont
    // réservés à la direction.
    if (user.role !== "DIR") {
      return {
        ...mine,
        team: [],
        allHours: [],
        allTravel: [],
        allAbsences: [],
        allRules: [],
      };
    }

    const [team, allHours, allTravel, allAbsences, allRules] =
      await Promise.all([
        prisma.user.findMany({
          where: { role: { in: ["DEV", "PM"] } },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            initials: true,
            role: true,
            leaveBalance: true,
            leaveAnchor: true,
            hoursBalance: true,
            hoursAnchor: true,
          },
        }),
        prisma.hoursEntry.findMany({
          where: { date: { gte: monthStart, lt: monthEnd } },
          include: {
            user: {
              select: { id: true, name: true, initials: true, role: true },
            },
          },
          orderBy: { date: "desc" },
        }),
        prisma.travelEntry.findMany({
          where: { startDate: { gte: monthStart, lt: monthEnd } },
          include: {
            user: {
              select: { id: true, name: true, initials: true, role: true },
            },
          },
          orderBy: { startDate: "desc" },
        }),
        prisma.absence.findMany({
          include: {
            user: {
              select: { id: true, name: true, initials: true, role: true },
            },
          },
          orderBy: { startDate: "desc" },
        }),
        prisma.presenceRecurrence.findMany({
          include: {
            user: {
              select: { id: true, name: true, initials: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    // Le solde disponible de chaque membre, calculé et non stocké.
    const teamBalances = await Promise.all(
      team.map(async (u) => ({
        userId: u.id,
        hours: await availableHours(u.id),
        leave: await availableLeave(u.id),
      })),
    );

    return {
      ...mine,
      team: team.map((u) => ({
        id: u.id,
        name: u.name,
        initials: u.initials,
        role: u.role,
        // Les valeurs ancrées telles que saisies, à distinguer du disponible.
        leaveAnchorValue: u.leaveBalance,
        leaveAnchorDate: u.leaveAnchor,
        hoursAnchorValue: u.hoursBalance,
        hoursAnchorDate: u.hoursAnchor,
      })),
      teamBalances,
      allHours,
      allTravel,
      allAbsences,
      allRules,
    };
  },
);

const absenceType = z.enum(["TELETRAVAIL", "CONGE", "ABSENCE", "FORMATION"]);
const halfDay = z.enum(["AM", "PM"]).nullable();
const verdict = z.enum(["VALIDE", "REFUSE"]);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add-hours"),
    kind: z.enum(["SUP", "RECUP"]),
    date: isoDateTime,
    hours: z.number().positive(),
    reason: z.string(),
    userId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("decide-hours"),
    entryId: z.string().min(1),
    status: verdict,
    // Ne concerne qu'une heure sup : payée (paie) ou mise en récup.
    paid: z.boolean(),
  }),
  z.object({ action: z.literal("delete-hours"), entryId: z.string().min(1) }),

  z.object({
    action: z.literal("add-absence"),
    type: absenceType,
    startDate: isoDateTime,
    endDate: isoDateTime,
    halfDay,
    motif: z.string(),
    paid: z.boolean(),
    userId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("update-absence"),
    absenceId: z.string().min(1),
    type: absenceType,
    startDate: isoDateTime,
    endDate: isoDateTime,
    halfDay,
    motif: z.string(),
    paid: z.boolean(),
  }),
  z.object({
    action: z.literal("decide-absence"),
    absenceId: z.string().min(1),
    status: verdict,
    paid: z.boolean(),
  }),
  z.object({
    action: z.literal("delete-absence"),
    absenceId: z.string().min(1),
  }),

  z.object({
    action: z.literal("set-shift"),
    date: isoDateTime,
    kind: z.enum(["BUREAU", "TELETRAVAIL", "CLIENT", "ABSENCE"]),
    note: z.string(),
  }),

  z.object({
    action: z.literal("add-travel"),
    startDate: isoDateTime,
    endDate: isoDateTime.nullable(),
    destination: z.string().min(1),
    motif: z.string(),
  }),
  z.object({
    action: z.literal("decide-travel"),
    entryId: z.string().min(1),
    status: verdict,
  }),

  z.object({
    action: z.literal("add-rule"),
    // « all » applique la règle à toute l'équipe, une ligne par personne.
    userId: z.string().min(1),
    effect: z.enum(["PRESENT", "TELETRAVAIL", "CONGE", "ABSENCE", "FORMATION"]),
    freq: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "DAILY"]),
    weekday: z.number().int().min(0).max(6).nullable(),
    monthday: z.number().int().min(1).max(31).nullable(),
    halfDay,
    startDate: isoDateTime,
    endDate: isoDateTime.nullable(),
    motif: z.string(),
    paid: z.boolean(),
  }),
  z.object({ action: z.literal("delete-rule"), ruleId: z.string().min(1) }),

  z.object({
    action: z.literal("set-balances"),
    userId: z.string().min(1),
    // Chaque solde est optionnel : la direction peut ne corriger que l'un des deux.
    leave: z.number().min(-999).max(9999).nullable(),
    hours: z.number().min(-999).max(9999).nullable(),
  }),
]);

function requireDir(role: string, what: string) {
  if (role !== "DIR") badRequest(`${what} : réservé à la direction`);
}

export const POST = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const parsed = bodySchema.safeParse(await jsonBody(request));
    if (!parsed.success) badRequest("Requête invalide");
    const body = parsed.data;
    const isDir = user.role === "DIR";

    switch (body.action) {
      case "add-hours": {
        const userId = targetUserId(user, body.userId);
        // Une récupération ne peut pas faire passer le solde d'heures sous zéro.
        if (
          body.kind === "RECUP" &&
          !(await canSpendHours(userId, body.hours))
        ) {
          const { available } = await availableHours(userId);
          badRequest(
            `Solde d'heures insuffisant : ${body.hours} h demandée(s) pour ${available} h.`,
          );
        }
        // La direction a plein pouvoir : sa saisie est validée d'office, elle n'a
        // pas à s'auto-approuver ensuite.
        const entry = await prisma.hoursEntry.create({
          data: {
            userId,
            kind: body.kind,
            date: new Date(body.date),
            hours: body.hours,
            reason: body.reason,
            status: isDir ? "VALIDE" : "DECLARE",
          },
        });
        // Inutile de prévenir la direction de sa propre saisie, déjà validée.
        if (!isDir) {
          await notifyRequestCreated({
            kind: "hours",
            authorName: user.name,
            details: hoursDetails(entry),
          });
        }
        return;
      }

      case "decide-hours": {
        requireDir(user.role, "Validation des heures");
        const entry = await prisma.hoursEntry.findUnique({
          where: { id: body.entryId },
        });
        if (!entry) notFound("Écriture introuvable");
        // Valider une récup ne doit pas faire passer le solde sous zéro : on
        // revérifie en ignorant l'écriture elle-même.
        if (body.status === "VALIDE" && entry.kind === "RECUP") {
          if (!(await canSpendHours(entry.userId, entry.hours, entry.id))) {
            const { available } = await availableHours(entry.userId, entry.id);
            badRequest(
              `Solde d'heures insuffisant : ${entry.hours} h pour ${available} h.`,
            );
          }
        }
        const decided = await prisma.hoursEntry.update({
          where: { id: body.entryId },
          // `paid` n'a de sens que sur une heure sup.
          data: {
            status: body.status,
            paid: entry.kind === "SUP" ? body.paid : false,
          },
        });
        await notifyRequestDecided({
          userId: decided.userId,
          approved: body.status === "VALIDE",
          what:
            decided.kind === "RECUP"
              ? "Récupération"
              : "Heures supplémentaires",
          agreement: decided.kind === "RECUP" ? "e" : "es",
          details: hoursDetails(decided),
        });
        return;
      }

      case "delete-hours": {
        const entry = await prisma.hoursEntry.findUnique({
          where: { id: body.entryId },
        });
        if (!entry) notFound("Écriture introuvable");
        if (!isDir) {
          if (entry.userId !== user.id)
            badRequest("Écriture d'un autre membre");
          // Une fois validée, seule la direction peut revenir dessus.
          if (entry.status === "VALIDE")
            badRequest("Déjà validée — annulation impossible");
        }
        await prisma.hoursEntry.delete({ where: { id: body.entryId } });
        return;
      }

      case "add-absence": {
        const userId = targetUserId(user, body.userId);
        const startIso = isoOf(new Date(body.startDate));
        const endIso = isoOf(new Date(body.endDate));
        if (endIso < startIso) badRequest("La date de fin précède le début");
        // Une demi-journée n'a de sens que sur une absence d'un seul jour.
        const half = startIso === endIso ? body.halfDay : null;

        const check = await canPostLeave(userId, {
          type: body.type,
          paid: body.paid,
          startIso,
          endIso,
          halfDay: half !== null,
        });
        if (!check.ok) badRequest(check.reason ?? "Solde insuffisant");

        const absence = await prisma.absence.create({
          data: {
            userId,
            type: body.type,
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            halfDay: half,
            motif: body.motif,
            paid: body.paid,
            status: isDir ? "VALIDE" : "DECLARE",
          },
        });
        if (!isDir) {
          await notifyRequestCreated({
            kind: "absence",
            authorName: user.name,
            details: absenceDetails(absence),
          });
        }
        return;
      }

      case "update-absence": {
        const existing = await prisma.absence.findUnique({
          where: { id: body.absenceId },
        });
        if (!existing) notFound("Absence introuvable");
        if (!isDir) {
          if (existing.userId !== user.id)
            badRequest("Absence d'un autre membre");
          if (existing.status !== "DECLARE")
            badRequest("Déjà traitée — modification impossible");
        }

        const startIso = isoOf(new Date(body.startDate));
        const endIso = isoOf(new Date(body.endDate));
        if (endIso < startIso) badRequest("La date de fin précède le début");
        const half = startIso === endIso ? body.halfDay : null;

        // On revérifie le solde en s'excluant soi-même : on remplace la demande,
        // on ne l'empile pas.
        const check = await canPostLeave(existing.userId, {
          type: body.type,
          paid: body.paid,
          startIso,
          endIso,
          halfDay: half !== null,
          excludeAbsenceId: existing.id,
        });
        if (!check.ok) badRequest(check.reason ?? "Solde insuffisant");

        await prisma.absence.update({
          where: { id: body.absenceId },
          data: {
            type: body.type,
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            halfDay: half,
            motif: body.motif,
            paid: body.paid,
            status: isDir ? "VALIDE" : "DECLARE",
          },
        });
        return;
      }

      case "decide-absence": {
        requireDir(user.role, "Validation des absences");
        const existing = await prisma.absence.findUnique({
          where: { id: body.absenceId },
        });
        if (!existing) notFound("Absence introuvable");

        // Valider — ou basculer une demande « non payée » en « payée » ici — ne
        // doit pas faire passer le solde sous zéro.
        if (body.status === "VALIDE") {
          const check = await canPostLeave(existing.userId, {
            type: existing.type,
            paid: body.paid,
            startIso: isoOf(existing.startDate),
            endIso: isoOf(existing.endDate),
            halfDay: existing.halfDay !== null,
            excludeAbsenceId: existing.id,
          });
          if (!check.ok) badRequest(check.reason ?? "Solde insuffisant");
        }

        const decidedAbsence = await prisma.absence.update({
          where: { id: body.absenceId },
          data: { status: body.status, paid: body.paid },
        });
        await notifyRequestDecided({
          userId: decidedAbsence.userId,
          approved: body.status === "VALIDE",
          what: "Absence",
          agreement: "e",
          details: absenceDetails(decidedAbsence),
        });
        return;
      }

      case "delete-absence": {
        const existing = await prisma.absence.findUnique({
          where: { id: body.absenceId },
        });
        if (!existing) notFound("Absence introuvable");
        if (!isDir) {
          if (existing.userId !== user.id)
            badRequest("Absence d'un autre membre");
          if (existing.status === "VALIDE")
            badRequest("Déjà validée — annulation impossible");
        }
        await prisma.absence.delete({ where: { id: body.absenceId } });
        return;
      }

      case "set-shift": {
        const date = new Date(body.date);
        await prisma.plannedShift.upsert({
          where: { userId_date: { userId: user.id, date } },
          update: { kind: body.kind, note: body.note },
          create: { userId: user.id, date, kind: body.kind, note: body.note },
        });
        return;
      }

      case "add-travel": {
        const travel = await prisma.travelEntry.create({
          data: {
            userId: user.id,
            startDate: new Date(body.startDate),
            endDate: body.endDate ? new Date(body.endDate) : null,
            destination: body.destination,
            motif: body.motif,
          },
        });
        if (!isDir) {
          await notifyRequestCreated({
            kind: "travel",
            authorName: user.name,
            details: travelDetails(travel),
          });
        }
        return;
      }

      case "decide-travel": {
        requireDir(user.role, "Validation des déplacements");
        const decidedTravel = await prisma.travelEntry.update({
          where: { id: body.entryId },
          data: { status: body.status },
        });
        await notifyRequestDecided({
          userId: decidedTravel.userId,
          approved: body.status === "VALIDE",
          what: "Déplacement",
          agreement: "",
          details: travelDetails(decidedTravel),
        });
        return;
      }

      case "add-rule": {
        requireDir(user.role, "Règles de présence");

        // Une règle hebdomadaire ou bimensuelle exige un jour de semaine, une
        // règle mensuelle un jour du mois. Une règle quotidienne ne prend ni l'un
        // ni l'autre : la période suffit.
        let weekday: number | null = null;
        let monthday: number | null = null;
        if (body.freq === "MONTHLY") {
          if (body.monthday === null) badRequest("Jour du mois requis");
          monthday = body.monthday;
        } else if (body.freq !== "DAILY") {
          if (body.weekday === null) badRequest("Jour de semaine requis");
          weekday = body.weekday;
        }

        const targets =
          body.userId === "all"
            ? (
                await prisma.user.findMany({
                  where: { role: { in: ["DEV", "PM"] } },
                  select: { id: true },
                })
              ).map((u) => u.id)
            : [body.userId];
        if (targets.length === 0) badRequest("Aucun membre ciblé");

        // Payé/non payé ne concerne que congé et absence.
        const paid =
          body.effect === "CONGE" || body.effect === "ABSENCE"
            ? body.paid
            : true;
        const startIso = isoOf(new Date(body.startDate));
        const endIso = body.endDate
          ? isoOf(new Date(body.endDate))
          : isoOf(new Date());

        // Une règle quotidienne de congé/absence payé décompte le solde : on
        // refuse tout le lot si un seul membre n'a pas le solde, en le nommant.
        if (
          paid &&
          body.freq === "DAILY" &&
          (body.effect === "CONGE" || body.effect === "ABSENCE")
        ) {
          for (const userId of targets) {
            const { defined, available } = await availableLeave(userId);
            const who = await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true },
            });
            const label = who?.name ?? "un membre";
            if (!defined) {
              badRequest(
                `Solde de congés non défini pour ${label} : à définir avant toute pose.`,
              );
            }
            const cost = leaveDaysInRange(
              startIso,
              endIso,
              body.halfDay !== null,
              null,
            );
            if (cost > available + 0.001) {
              badRequest(
                `Solde insuffisant pour ${label} : ${cost} j pour ${available} j disponible(s).`,
              );
            }
          }
        }

        await prisma.presenceRecurrence.createMany({
          data: targets.map((userId) => ({
            userId,
            effect: body.effect,
            freq: body.freq,
            weekday,
            monthday,
            halfDay: body.halfDay,
            startDate: new Date(body.startDate),
            endDate: body.endDate ? new Date(body.endDate) : null,
            motif: body.motif,
            paid,
          })),
        });
        return { ok: true, created: targets.length };
      }

      case "delete-rule":
        requireDir(user.role, "Règles de présence");
        await prisma.presenceRecurrence.delete({ where: { id: body.ruleId } });
        return;

      case "set-balances": {
        requireDir(user.role, "Saisie des soldes");
        if (body.leave === null && body.hours === null)
          badRequest("Aucun solde fourni");

        // La valeur saisie est le solde RÉEL du moment : la date du jour devient
        // l'ancre, et le calcul repart de là. Sans cela on recompterait tout
        // l'historique déjà inclus dans le chiffre saisi.
        const today = new Date();
        await prisma.user.update({
          where: { id: body.userId },
          data: {
            ...(body.leave !== null
              ? { leaveBalance: body.leave, leaveAnchor: today }
              : {}),
            ...(body.hours !== null
              ? { hoursBalance: body.hours, hoursAnchor: today }
              : {}),
          },
        });
        return;
      }
    }
  },
);
