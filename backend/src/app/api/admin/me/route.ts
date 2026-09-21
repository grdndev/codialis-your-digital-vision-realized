import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SCHEDULE } from "@/lib/work-time";

export const dynamic = "force-dynamic";

// GET /api/admin/me — identité de la session, pour le bandeau et les gardes de
// rôle du frontend, plus les réglages personnels de l'écran Paramètres. Ni le
// hash du mot de passe ni les relations ne sortent.
//
// `user` garde exactement la forme qu'attendent les layouts : les réglages
// arrivent à côté, dans `settings`, pour ne pas alourdir la session.
export const GET = adminRoute([], async ({ user }) => {
  // La réponse automatique d'absence est propre à la personne connectée
  // (`AbsenceSetting.pmId`) et ne concerne que celles qui suivent des clients.
  const absence =
    user.role === "PM" || user.role === "DIR"
      ? await prisma.absenceSetting.findUnique({
          where: { pmId: user.id },
          select: {
            mode: true,
            enabled: true,
            messageConges: true,
            messageHoraires: true,
          },
        })
      : null;

  // Les horaires de travail bornent le temps mesuré : une tâche laissée « en
  // cours » le soir ne compte pas la nuit. Sans réglage personnel, l'horaire
  // par défaut de l'agence s'applique — chacun peut le corriger.
  const schedule =
    user.role === "CLIENT" ? null : await prisma.workSchedule.findUnique({ where: { userId: user.id } });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
      role: user.role,
      clientId: user.clientId,
    },
    settings: {
      jobTitle: user.jobTitle,
      photo: user.photo,
      absence,
      schedule:
        user.role === "CLIENT"
          ? null
          : {
              startMin: schedule?.startMin ?? DEFAULT_SCHEDULE.startMin,
              breakStartMin: schedule ? schedule.breakStartMin : DEFAULT_SCHEDULE.breakStartMin,
              breakEndMin: schedule ? schedule.breakEndMin : DEFAULT_SCHEDULE.breakEndMin,
              endMin: schedule?.endMin ?? DEFAULT_SCHEDULE.endMin,
              weekdays: schedule?.weekdays ?? DEFAULT_SCHEDULE.weekdays.join(","),
              // Vrai tant que la personne n'a rien réglé : l'écran le dit.
              isDefault: !schedule,
            },
    },
  };
});

const bodySchema = z.discriminatedUnion("action", [
  // L'intitulé et la photo s'affichent sous le nom dans la section « équipe »
  // du site vitrine. Chacun rédige les siens ; le rôle applicatif, lui, reste
  // à la direction. La photo est une data URL base64, comme les images du
  // site — pas de service de fichiers à héberger.
  z.object({
    action: z.literal("update-profile"),
    jobTitle: z.string().max(255).nullable(),
    photo: z.string().nullable(),
  }),
  // Horaires de travail. Les minutes depuis minuit évitent tout fuseau : c'est
  // une heure locale de bureau, pas un instant. Aucune plage supplémentaire
  // n'est réglable ici : une soirée travaillée se déclare en RH, où elle est
  // validée et alimente le solde d'heures.
  z.object({
    action: z.literal("update-schedule"),
    startMin: z.number().int().min(0).max(1440),
    endMin: z.number().int().min(0).max(1440),
    breakStartMin: z.number().int().min(0).max(1440).nullable(),
    breakEndMin: z.number().int().min(0).max(1440).nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  z.object({
    action: z.literal("set-absence-mode"),
    mode: z.enum(["OUVERT", "HORAIRES", "CONGES"]),
  }),
  // Le message envoyé au client se rédige. Vide, le texte par défaut de
  // l'agence reprend sa place — c'est aussi la façon de revenir en arrière.
  z.object({
    action: z.literal("set-absence-message"),
    mode: z.enum(["HORAIRES", "CONGES"]),
    message: z.string().max(2000),
  }),
  z.object({ action: z.literal("toggle-absence-enabled") }),
]);

// POST /api/admin/me — ses propres réglages, jamais ceux d'un autre : la clé
// vient toujours de la session, jamais du corps de la requête.
export const POST = adminRoute([], async ({ user, }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  // Un compte client n'a ni intitulé sur le site vitrine ni réponse d'absence.
  if (user.role === "CLIENT") badRequest("Réglage indisponible sur un compte client");

  switch (body.action) {
    case "update-profile": {
      const jobTitle = body.jobTitle?.trim();
      const photo = body.photo?.trim();
      await prisma.user.update({
        where: { id: user.id },
        data: { jobTitle: jobTitle || null, photo: photo || null },
      });
      return;
    }

    case "update-schedule": {
      if (body.endMin <= body.startMin) badRequest("La fin doit suivre le début");
      // Une pause incomplète ou à l'envers ne borne rien : on n'en garde une
      // que si elle tient debout.
      const hasBreak =
        body.breakStartMin !== null &&
        body.breakEndMin !== null &&
        body.breakEndMin > body.breakStartMin;
      const data = {
        startMin: body.startMin,
        endMin: body.endMin,
        breakStartMin: hasBreak ? body.breakStartMin : null,
        breakEndMin: hasBreak ? body.breakEndMin : null,
        weekdays: [...new Set(body.weekdays)].sort((a, b) => a - b).join(","),
      };
      await prisma.workSchedule.upsert({
        where: { userId: user.id },
        update: data,
        create: { userId: user.id, ...data },
      });
      return;
    }

    case "set-absence-mode": {
      if (user.role !== "PM" && user.role !== "DIR") {
        badRequest("Réservé aux comptes qui suivent des clients");
      }
      // « Disponible » n'a pas de réponse à envoyer : l'interrupteur suit le
      // mode plutôt que de pouvoir le contredire.
      const enabled = body.mode !== "OUVERT";
      await prisma.absenceSetting.upsert({
        where: { pmId: user.id },
        update: { mode: body.mode, enabled },
        create: { pmId: user.id, mode: body.mode, enabled },
      });
      return;
    }

    case "set-absence-message": {
      if (user.role !== "PM" && user.role !== "DIR") {
        badRequest("Réservé aux comptes qui suivent des clients");
      }
      const text = body.message.trim() || null;
      const data =
        body.mode === "CONGES" ? { messageConges: text } : { messageHoraires: text };
      await prisma.absenceSetting.upsert({
        where: { pmId: user.id },
        update: data,
        create: { pmId: user.id, ...data },
      });
      return;
    }

    case "toggle-absence-enabled": {
      const current = await prisma.absenceSetting.findUnique({ where: { pmId: user.id } });
      if (!current) badRequest("Aucun réglage d'absence à basculer");
      await prisma.absenceSetting.update({
        where: { pmId: user.id },
        data: { enabled: !current.enabled },
      });
      return;
    }
  }
});
