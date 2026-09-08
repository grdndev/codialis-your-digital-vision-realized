import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { isContentType, shapeContent, type ContentType } from "@/lib/site-content";
import {
  blogSchema,
  portfolioSchema,
  testimonialSchema,
  initialsOf,
  TESTIMONIAL_PALETTE,
} from "@/lib/site-schemas";

export const dynamic = "force-dynamic";

// Contenu éditorial du site vitrine : articles de blog, projets du portfolio,
// témoignages. Direction et chefferie de projet, comme l'écriture de contenu
// dans l'ancien back-office.
//
// Le `data` stocké est un blob JSON dont la forme est dictée par le code de
// lecture du site public (voir src/lib/site-schemas.ts). C'est pour cela que
// chaque type est validé par son propre schéma : une clé manquante ou mal
// nommée ne casserait pas l'API, elle casserait la page publique.

const SCHEMA_BY_TYPE = {
  blog: blogSchema,
  portfolio: portfolioSchema,
  testimonials: testimonialSchema,
} as const;

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const type = request.nextUrl.searchParams.get("type");
  if (!type || !isContentType(type)) badRequest("Type de contenu inconnu");

  const rows = await prisma.content.findMany({
    where: { type },
    select: { id: true, data: true, views: true },
    orderBy: { createdAt: "desc" },
  });

  // Même forme aplatie que la route publique : le formulaire d'édition se
  // pré-remplit directement depuis la liste, sans conversion.
  return { items: rows.map(shapeContent) };
});

// Un seul élément par type peut être « à la une » : mettre un projet en avant
// doit décrocher le précédent, sinon la page publique en afficherait deux.
async function unfeatureOthers(type: ContentType, keepId: string) {
  const rows = await prisma.content.findMany({
    where: { type, id: { not: keepId } },
    select: { id: true, data: true },
  });

  for (const row of rows) {
    const data = row.data as Prisma.JsonObject | null;
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    if (data.featured !== true) continue;
    await prisma.content.update({
      where: { id: row.id },
      data: { data: { ...data, featured: false } as Prisma.InputJsonValue },
    });
  }
}

// Les témoignages portent deux champs dérivés que le formulaire ne saisit pas :
// les initiales de l'auteur et sa couleur d'avatar. La couleur est conservée
// telle quelle à l'édition, pour qu'un témoignage ne change pas de teinte à
// chaque correction de faute.
async function withDerivedFields(
  type: ContentType,
  data: Record<string, unknown>,
  existing: Prisma.JsonObject | null,
): Promise<Record<string, unknown>> {
  if (type !== "testimonials") return data;

  const previousBg = existing && typeof existing.bg === "string" ? existing.bg : null;
  if (previousBg) {
    return { ...data, initials: initialsOf(String(data.author ?? "")), bg: previousBg };
  }

  const count = await prisma.content.count({ where: { type: "testimonials" } });
  return {
    ...data,
    initials: initialsOf(String(data.author ?? "")),
    bg: TESTIMONIAL_PALETTE[count % TESTIMONIAL_PALETTE.length],
  };
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    type: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("update"),
    type: z.string().min(1),
    id: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("delete"),
    type: z.string().min(1),
    id: z.string().min(1),
  }),
]);

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (!isContentType(body.type)) badRequest("Type de contenu inconnu");
  const type = body.type;

  if (body.action === "delete") {
    const { count } = await prisma.content.deleteMany({ where: { id: body.id, type } });
    if (count === 0) notFound("Contenu introuvable");
    return;
  }

  // `id` et `views` n'appartiennent pas au blob : ce sont des colonnes. Un
  // client qui les enverrait ne doit pas pouvoir réécrire un compteur de vues.
  const submitted = { ...body.data };
  delete submitted.id;
  delete submitted.views;

  const validated = SCHEMA_BY_TYPE[type].safeParse(submitted);
  if (!validated.success) {
    const field = validated.error.issues[0]?.path.join(".") || "inconnu";
    badRequest(`Champ invalide : ${field}`);
  }

  if (body.action === "create") {
    const data = await withDerivedFields(type, validated.data, null);
    const created = await prisma.content.create({
      data: { type, data: data as Prisma.InputJsonValue, views: BigInt(0) },
      select: { id: true },
    });
    if (data.featured === true) await unfeatureOthers(type, created.id);
    return { ok: true, id: created.id };
  }

  const existing = await prisma.content.findFirst({
    where: { id: body.id, type },
    select: { id: true, data: true },
  });
  if (!existing) notFound("Contenu introuvable");

  const data = await withDerivedFields(
    type,
    validated.data,
    existing.data as Prisma.JsonObject | null,
  );
  await prisma.content.update({
    where: { id: existing.id },
    data: { data: data as Prisma.InputJsonValue },
  });
  if (data.featured === true) await unfeatureOthers(type, existing.id);
  return { ok: true, id: existing.id };
});
