import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { maxSuffix, withUniqueRef } from "@/lib/refs";

export const dynamic = "force-dynamic";

// Écran « Messagerie interne ».
//
// Un utilisateur ne voit que les fils auxquels il participe : la liste part de
// ses propres inscriptions (`threadParticipant`), jamais d'une liste de fils
// filtrée après coup.

export const GET = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const requestedThreadId = request.nextUrl.searchParams.get("thread");
    // L'onglet courant décide quel fil est ouvert par défaut : les fils de
    // projet et les fils directs forment deux listes distinctes.
    const tab =
      request.nextUrl.searchParams.get("tab") === "direct"
        ? "direct"
        : "project";

    const memberships = await prisma.threadParticipant.findMany({
      where: { userId: user.id },
      include: {
        thread: {
          include: {
            project: { include: { client: true } },
            participants: { include: { user: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    // Les non-lus sont comptés AVANT de marquer le fil ouvert comme lu : le
    // badge doit refléter ce que l'utilisateur n'avait pas encore vu en arrivant.
    const rows = await Promise.all(
      memberships.map(async (m) => ({
        thread: m.thread,
        lastReadAt: m.lastReadAt,
        unread: await prisma.message.count({
          where: {
            threadId: m.threadId,
            authorId: { not: user.id },
            createdAt: m.lastReadAt ? { gt: m.lastReadAt } : undefined,
          },
        }),
        lastMessage: m.thread.messages[0] ?? null,
      })),
    );

    // Le fil ouvert : celui demandé s'il appartient bien à l'utilisateur —
    // sinon le plus récent de l'onglet courant, pour que l'écran ne s'affiche
    // jamais sans conversation.
    const inTab = rows.filter((r) =>
      tab === "direct"
        ? r.thread.kind === "DIRECT"
        : r.thread.kind !== "DIRECT",
    );
    const mostRecentFirst = [...inTab].sort(
      (a, b) =>
        (b.lastMessage?.createdAt.getTime() ?? 0) -
        (a.lastMessage?.createdAt.getTime() ?? 0),
    );
    const selected =
      (requestedThreadId
        ? rows.find((r) => r.thread.id === requestedThreadId)
        : undefined) ??
      mostRecentFirst[0] ??
      null;

    const detail = selected
      ? await prisma.messageThread.findUnique({
          where: { id: selected.thread.id },
          include: {
            project: { include: { client: true } },
            participants: { include: { user: true } },
            messages: {
              include: { author: true },
              orderBy: { createdAt: "asc" },
            },
          },
        })
      : null;

    // Ouvrir un fil vaut accusé de lecture.
    if (selected) {
      await prisma.threadParticipant.updateMany({
        where: { threadId: selected.thread.id, userId: user.id },
        data: { lastReadAt: new Date() },
      });
    }

    const projects = await prisma.project.findMany({
      where: { group: { not: "CLO" } },
      include: { client: true },
      orderBy: { name: "asc" },
    });

    return { rows, detail, projects };
  },
);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    threadId: z.string().min(1),
    body: z.string().min(1),
  }),
  z.object({
    action: z.literal("convert-to-ticket"),
    messageId: z.string().min(1),
    title: z.string().min(1),
    type: z.enum(["BUG", "DEV"]),
    projectId: z.string().min(1),
  }),
  z.object({ action: z.literal("mark-read"), threadId: z.string().min(1) }),
]);

export const POST = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const parsed = bodySchema.safeParse(await jsonBody(request));
    if (!parsed.success) badRequest("Requête invalide");
    const body = parsed.data;

    if (body.action === "mark-read") {
      await prisma.threadParticipant.updateMany({
        where: { threadId: body.threadId, userId: user.id },
        data: { lastReadAt: new Date() },
      });
      return;
    }

    if (body.action === "send") {
      // On n'écrit que dans un fil dont on est participant.
      const membership = await prisma.threadParticipant.findUnique({
        where: {
          threadId_userId: { threadId: body.threadId, userId: user.id },
        },
      });
      if (!membership) badRequest("Fil inaccessible");

      await prisma.$transaction([
        prisma.message.create({
          data: { threadId: body.threadId, authorId: user.id, body: body.body },
        }),
        // Son propre message est lu d'office.
        prisma.threadParticipant.updateMany({
          where: { threadId: body.threadId, userId: user.id },
          data: { lastReadAt: new Date() },
        }),
      ]);
      return;
    }

    const [message, project] = await Promise.all([
      prisma.message.findUnique({ where: { id: body.messageId } }),
      prisma.project.findUnique({ where: { id: body.projectId } }),
    ]);

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
        ) ?? 400) + 1
      }`;
    };

    await withUniqueRef(nextRef, (ref) =>
      prisma.ticket.create({
        data: {
          ref,
          projectId: body.projectId,
          type: body.type,
          // Un bug part en gravité mineure, un développement en nature front :
          // valeurs de départ que le triage affine ensuite.
          severity: body.type === "BUG" ? "MINEUR" : null,
          devNature: body.type === "DEV" ? "FRONT" : null,
          title: body.title,
          // Le corps du message devient la description du ticket.
          description: message?.body ?? "",
          estHours: 0,
          creatorId: user.id,
          steps: "",
        },
      }),
    );
  },
);
