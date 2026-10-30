import { z } from "zod";
import { adminRoute, badRequest, parseBody, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId, portalProjectParam } from "@/lib/client-scope";
import { maxSuffix, withUniqueRef } from "@/lib/refs";

export const dynamic = "force-dynamic";

// Portail client — écran « Signalements ».
//
// Seuls les tickets remontés par le client apparaissent : le travail interne de
// l'agence sur le projet ne lui est pas exposé, pas plus que les tickets
// annulés (CC-372), même les siens.

const querySchema = z.object({ project: portalProjectParam });

export const GET = adminRoute(["CLIENT"], async ({ user }, request) => {
  const query = parseQuery(querySchema, request);
  const projectId = await clientProjectId(user, query.project);
  if (!projectId) return { tickets: [] };

  return {
    tickets: await prisma.ticket.findMany({
      where: { projectId, clientReported: true, status: { not: "ANNULE" } },
      orderBy: { createdAt: "desc" },
    }),
  };
}, {
  summary:
    "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Signalements remontés par le client sur son projet.",
  query: querySchema,
});

const createSchema = z.object({
  action: z.literal("create-ticket"),
  type: z.enum(["BUG", "DEV"]),
  title: z.string().min(1),
  description: z.string(),
  severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
  project: z.string().nullable().optional().describe("Projet du client ; absent ou étranger = le premier de ses projets"),
});

export const POST = adminRoute(["CLIENT"], async ({ user }, request) => {
  const body = await parseBody(createSchema, request);

  const projectId = await clientProjectId(user, body.project);
  if (!projectId) badRequest("Aucun projet rattaché à ce compte");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { initials: true },
  });

  const prefix = `${project?.initials ?? "TIX"}-`;
  const nextRef = async () => {
    const refs = await prisma.ticket.findMany({
      where: { ref: { startsWith: prefix } },
      select: { ref: true },
    });
    return `${prefix}${
      (maxSuffix(
        refs.map((r) => r.ref),
        prefix,
      ) ?? 500) + 1
    }`;
  };

  await withUniqueRef(nextRef, (ref) =>
    prisma.ticket.create({
      data: {
        ref,
        projectId,
        type: body.type,
        // La gravité ne concerne qu'un bug.
        severity: body.type === "BUG" ? (body.severity ?? "MINEUR") : null,
        title: body.title,
        description: body.description,
        estHours: 0,
        clientReported: true,
        // Un bug part en qualification, une demande d'ajout part au chiffrage.
        triageState: body.type === "BUG" ? "A_QUALIFIER" : "A_CHIFFRER",
        steps: ""
      },
    }),
  );
}, { summary: "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Signale un bug ou demande un ajout ; part au triage de l'agence.", body: createSchema });
