import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId } from "@/lib/client-scope";
import { maxSuffix, withUniqueRef } from "@/lib/refs";

export const dynamic = "force-dynamic";

// Portail client — écran « Signalements ».
//
// Seuls les tickets remontés par le client apparaissent : le travail interne de
// l'agence sur le projet ne lui est pas exposé.

export const GET = adminRoute(["CLIENT"], async ({ user }) => {
  const projectId = await clientProjectId(user.id);
  if (!projectId) return { tickets: [] };

  return {
    tickets: await prisma.ticket.findMany({
      where: { projectId, clientReported: true },
      orderBy: { createdAt: "desc" },
    }),
  };
});

const createSchema = z.object({
  action: z.literal("create-ticket"),
  type: z.enum(["BUG", "DEV"]),
  title: z.string().min(1),
  description: z.string(),
  severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
});

export const POST = adminRoute(["CLIENT"], async ({ user }, request) => {
  const parsed = createSchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  const projectId = await clientProjectId(user.id);
  if (!projectId) badRequest("Aucun projet affecté à ce compte");

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
      },
    }),
  );
});
