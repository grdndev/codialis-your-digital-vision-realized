import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « RH » — heures supplémentaires, planning de la semaine, déplacements.
//
// Les bornes de période sont fournies par l'appelant plutôt que recalculées
// ici, et c'est délibéré : la grille du planning retrouve chaque créneau par
// égalité EXACTE de date. Si le backend recalculait « la semaine courante » de
// son côté, le moindre décalage (fuseau, minuit franchi entre les deux calculs)
// ferait disparaître un créneau de sa propre case. Un seul endroit décide ce
// qu'est « cette semaine » : l'écran.

const isoDate = z.string().datetime();

const querySchema = z.object({
  monthStart: isoDate,
  monthEnd: isoDate,
  weekdays: z.array(isoDate).min(1).max(7),
});

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
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

  const [myOvertime, myShifts, myTravel] = await Promise.all([
    prisma.overtimeEntry.findMany({
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "desc" },
    }),
    prisma.plannedShift.findMany({ where: { userId: user.id, date: { in: weekdays } } }),
    prisma.travelEntry.findMany({ where: { userId: user.id }, orderBy: { startDate: "desc" } }),
  ]);

  // La synthèse d'équipe et la file de validation sont réservées à la direction.
  if (user.role !== "DIR") {
    return { myOvertime, myShifts, myTravel, team: [], allOvertime: [], allTravel: [] };
  }

  const [team, allOvertime, allTravel] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["DEV", "PM"] } }, orderBy: { name: "asc" } }),
    prisma.overtimeEntry.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      include: { user: true },
    }),
    prisma.travelEntry.findMany({
      where: { startDate: { gte: monthStart, lt: monthEnd } },
      include: { user: true },
    }),
  ]);

  return {
    myOvertime,
    myShifts,
    myTravel,
    team: team.map((u) => ({ id: u.id, name: u.name, initials: u.initials, role: u.role })),
    allOvertime,
    allTravel,
  };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add-overtime"),
    date: isoDate,
    hours: z.number().positive(),
    reason: z.string(),
  }),
  z.object({
    action: z.literal("set-shift"),
    date: isoDate,
    kind: z.enum(["BUREAU", "TELETRAVAIL", "CLIENT", "ABSENCE"]),
    note: z.string(),
  }),
  z.object({
    action: z.literal("add-travel"),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    destination: z.string().min(1),
    motif: z.string(),
  }),
  z.object({ action: z.literal("validate-overtime"), entryId: z.string().min(1) }),
  z.object({ action: z.literal("validate-travel"), entryId: z.string().min(1) }),
]);

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  // Une déclaration est toujours pour soi : l'auteur vient de la session.
  switch (body.action) {
    case "add-overtime":
      await prisma.overtimeEntry.create({
        data: { userId: user.id, date: new Date(body.date), hours: body.hours, reason: body.reason },
      });
      return;

    case "set-shift": {
      const date = new Date(body.date);
      await prisma.plannedShift.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: { kind: body.kind, note: body.note },
        create: { userId: user.id, date, kind: body.kind, note: body.note },
      });
      return;
    }

    case "add-travel":
      await prisma.travelEntry.create({
        data: {
          userId: user.id,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : null,
          destination: body.destination,
          motif: body.motif,
        },
      });
      return;

    // Valider une déclaration d'un membre de l'équipe : direction uniquement.
    case "validate-overtime":
      if (user.role !== "DIR") badRequest("Réservé à la direction");
      await prisma.overtimeEntry.update({ where: { id: body.entryId }, data: { status: "VALIDE" } });
      return;

    case "validate-travel":
      if (user.role !== "DIR") badRequest("Réservé à la direction");
      await prisma.travelEntry.update({ where: { id: body.entryId }, data: { status: "VALIDE" } });
      return;
  }
});
