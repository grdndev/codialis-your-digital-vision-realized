import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Remontées client » — le triage des signalements remontés par un client.

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const ref = request.nextUrl.searchParams.get("ref");

  const [all, team] = await Promise.all([
    prisma.ticket.findMany({
      where: { clientReported: true },
      include: { project: { include: { client: true } }, assignee: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { role: { in: ["DEV", "PM"] } }, orderBy: { name: "asc" } }),
  ]);

  // Le ticket ouvert par défaut est le premier de la liste ; `?ref=` en désigne
  // un autre. Son détail est chargé dans la même requête pour éviter un
  // aller-retour supplémentaire à chaque changement de sélection.
  const selected = ref ? all.find((t) => t.ref === ref) : all[0];
  const detail = selected
    ? await prisma.ticket.findUnique({
        where: { id: selected.id },
        include: {
          project: { include: { client: true } },
          assignee: true,
          attachments: true,
          triageReplies: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  return {
    all,
    team: team.map((u) => ({ id: u.id, name: u.name, initials: u.initials, role: u.role })),
    detail,
  };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("qualify"),
    ticketId: z.string().min(1),
    module: z.string().nullable(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
    assigneeId: z.string().nullable(),
    estHours: z.number().min(0),
    nextState: z.enum(["A_QUALIFIER", "A_CHIFFRER", "TRANSMIS", "DEVIS_ENVOYE", "CLOS"]).nullable(),
  }),
  z.object({ action: z.literal("reopen"), ticketId: z.string().min(1) }),
  z.object({
    action: z.literal("add-reply"),
    ticketId: z.string().min(1),
    body: z.string().min(1),
  }),
]);

export const POST = adminRoute(["PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  switch (body.action) {
    case "qualify":
      await prisma.ticket.update({
        where: { id: body.ticketId },
        data: {
          module: body.module,
          severity: body.severity,
          assigneeId: body.assigneeId,
          estHours: body.estHours,
          // `null` = le formulaire n'a pas proposé de transition : on ne touche
          // pas à l'état du triage.
          triageState: body.nextState ?? undefined,
        },
      });
      return;

    case "reopen":
      await prisma.ticket.update({
        where: { id: body.ticketId },
        data: { triageState: "A_QUALIFIER" },
      });
      return;

    case "add-reply":
      // L'auteur affiché vient de la session : c'est celui qui écrit, pas un
      // libellé posté par le client de l'API.
      await prisma.triageReply.create({
        data: {
          ticketId: body.ticketId,
          authorLabel: user.name,
          body: body.body,
          mine: true,
        },
      });
      return;
  }
});
