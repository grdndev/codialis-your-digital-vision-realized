import { z } from "zod";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Ce que le site vitrine fait remonter : demandes du formulaire de contact,
// abonnés à la newsletter, et compteurs de visites des pages publiques.

const CONTACT_STATUSES = ["nouveau", "en_cours", "traite"] as const;

export const GET = adminRoute(["PM", "DIR"], async () => {
  const [contactRequests, subscribers, views, contentViews] = await Promise.all([
    prisma.contactRequest.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.pageView.findMany({ where: { page: { in: ["portfolio", "blog"] } } }),
    // Les 5 contenus les plus consultés, toutes catégories confondues.
    prisma.content.findMany({
      where: { views: { gt: 0 } },
      select: { id: true, type: true, data: true, views: true },
      orderBy: { views: "desc" },
      take: 5,
    }),
  ]);

  const pageViews = { portfolio: 0, blog: 0 };
  for (const row of views) {
    if (row.page === "portfolio" || row.page === "blog") {
      pageViews[row.page] = Number(row.count);
    }
  }

  return {
    contactRequests,
    subscribers,
    pageViews,
    topContent: contentViews.map((row) => {
      const data = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
      return {
        id: row.id,
        type: row.type,
        title: typeof data.title === "string" ? data.title : "(sans titre)",
        views: Number(row.views),
      };
    }),
  };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-contact-status"),
    id: z.string().min(1),
    status: z.enum(CONTACT_STATUSES),
  }),
  z.object({ action: z.literal("delete-contact"), id: z.string().min(1) }),
  z.object({ action: z.literal("delete-subscriber"), id: z.string().min(1) }),
]);

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  switch (body.action) {
    case "set-contact-status": {
      const { count } = await prisma.contactRequest.updateMany({
        where: { id: body.id },
        data: { status: body.status },
      });
      if (count === 0) notFound("Demande introuvable");
      return;
    }
    case "delete-contact": {
      const { count } = await prisma.contactRequest.deleteMany({ where: { id: body.id } });
      if (count === 0) notFound("Demande introuvable");
      return;
    }
    case "delete-subscriber": {
      // Une désinscription depuis le back-office : le visiteur peut aussi le
      // faire lui-même depuis le lien de la newsletter.
      const { count } = await prisma.newsletterSubscriber.deleteMany({ where: { id: body.id } });
      if (count === 0) notFound("Abonné introuvable");
      return;
    }
  }
});
