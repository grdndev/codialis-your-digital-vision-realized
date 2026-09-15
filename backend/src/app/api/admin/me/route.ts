import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

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
          select: { mode: true, enabled: true },
        })
      : null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
      role: user.role,
      clientId: user.clientId,
    },
    settings: { jobTitle: user.jobTitle, photo: user.photo, absence },
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
  z.object({
    action: z.literal("set-absence-mode"),
    mode: z.enum(["OUVERT", "HORAIRES", "CONGES"]),
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
