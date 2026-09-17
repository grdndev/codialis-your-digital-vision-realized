import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Échanges ».

export const GET = adminRoute(["CLIENT"], async ({ user }) => {
  const projectId = await clientProjectId(user.id);
  if (!projectId) return { messages: [], pm: null, absence: null };

  const [messages, pm, absence] = await Promise.all([
    prisma.clientThreadMessage.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.user.findFirst({ where: { role: "PM" }, orderBy: { name: "asc" } }),
    // Une seule réponse automatique peut être active à la fois.
    prisma.absenceSetting.findFirst({ where: { enabled: true } }),
  ]);

  return {
    messages,
    // Seul le nom de la cheffe de projet est exposé au client.
    pm: pm ? { id: pm.id, name: pm.name } : null,
    // Le message rédigé par la cheffe de projet prend le pas sur le texte par
    // défaut ; vide, c'est le portail qui met le sien.
    absence: absence
      ? {
          mode: absence.mode,
          message:
            (absence.mode === "CONGES" ? absence.messageConges : absence.messageHoraires) ?? null,
        }
      : null,
  };
});

const sendSchema = z.object({ action: z.literal("send"), body: z.string().min(1) });

export const POST = adminRoute(["CLIENT"], async ({ user }, request) => {
  const parsed = sendSchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");

  const projectId = await clientProjectId(user.id);
  if (!projectId) badRequest("Aucun projet affecté à ce compte");

  await prisma.clientThreadMessage.create({
    data: { projectId, fromClient: true, authorLabel: user.name, body: parsed.data.body },
  });
});
