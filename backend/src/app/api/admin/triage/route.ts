import { z } from "zod";
import { adminRoute, parseBody, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { USER_IDENTITY } from "@/lib/user-identity";
import { TICKET_ID_DESCRIPTION, withTicketIds } from "@/lib/ticket-ref";

export const dynamic = "force-dynamic";

// Écran « Remontées client » — le triage des signalements remontés par un client.

const querySchema = z.object({
  ref: z.string().optional().describe("Référence du ticket dont charger le dossier"),
});

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const { ref } = parseQuery(querySchema, request);

  const [all, team] = await Promise.all([
    prisma.ticket.findMany({
      where: { clientReported: true },
      include: { project: { include: { client: true } }, assignee: USER_IDENTITY },
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
          assignee: USER_IDENTITY,
          attachments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          triageReplies: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  return {
    all,
    team: team.map((u) => ({ id: u.id, name: u.name, initials: u.initials, role: u.role })),
    detail,
  };
}, {
  summary:
    "Remontées client : tickets signalés par un client, équipe, et le dossier complet (`detail`) du ticket choisi par `ref` (le premier par défaut).",
  query: querySchema,
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("qualify"),
    ticketId: z.string().min(1).describe(TICKET_ID_DESCRIPTION),
    module: z.string().nullable(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
    assigneeId: z.string().nullable(),
    estHours: z.number().min(0),
    nextState: z
      .enum(["A_QUALIFIER", "A_CHIFFRER", "TRANSMIS", "DEVIS_ENVOYE", "CLOS"])
      .nullable()
      .describe("null = état du triage inchangé"),
  }).describe("Qualifie une remontée : module, gravité, assigné, estimation, état du triage."),
  z.object({ action: z.literal("reopen"), ticketId: z.string().min(1).describe(TICKET_ID_DESCRIPTION) }).describe(
    "Remet une remontée à qualifier.",
  ),
  z.object({
    action: z.literal("add-reply"),
    ticketId: z.string().min(1).describe(TICKET_ID_DESCRIPTION),
    body: z.string().min(1),
  }).describe("Ajoute une réponse au fil du triage, au nom du compte appelant."),
]);

export const POST = adminRoute(["PM", "DIR"], async ({ user }, request) => {
  const body = await withTicketIds(await parseBody(bodySchema, request));

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
}, { summary: "Triage des remontées client (PM, DIR).", body: bodySchema });
