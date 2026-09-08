import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, settingsSchemas } from "@/lib/site-schemas";

export const dynamic = "force-dynamic";

// Réglages de page du site vitrine : en-tête du blog, en-tête du portfolio,
// réseaux sociaux, logos clients.
//
// Chaque clé porte un blob JSON que la page publique lit champ par champ, avec
// un repli sur ses valeurs codées en dur quand un champ est vide. Un réglage
// jamais enregistré renvoie donc `{}`, et la page garde ses défauts.

export const GET = adminRoute(["PM", "DIR"], async () => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: SETTING_KEYS } },
    select: { key: true, data: true, updatedAt: true },
  });

  const byKey = new Map(rows.map((r) => [r.key, r]));
  return {
    settings: Object.fromEntries(
      SETTING_KEYS.map((key) => [
        key,
        { data: byKey.get(key)?.data ?? {}, updatedAt: byKey.get(key)?.updatedAt ?? null },
      ]),
    ),
  };
});

const bodySchema = z.object({
  action: z.literal("update"),
  key: z.enum(SETTING_KEYS),
  data: z.record(z.string(), z.unknown()),
});

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const { key, data } = parsed.data;

  const validated = settingsSchemas[key].safeParse(data);
  if (!validated.success) {
    const field = validated.error.issues[0]?.path.join(".") || "inconnu";
    badRequest(`Champ invalide : ${field}`);
  }

  const existing = await prisma.setting.findUnique({ where: { key }, select: { data: true } });
  const current =
    existing?.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? (existing.data as Prisma.JsonObject)
      : {};

  // Fusion au premier niveau, et c'est important : enregistrer l'en-tête du
  // portfolio ne doit pas effacer son bloc `featured`, que le site lit en
  // repli quand aucun projet n'est coché « à la une ». Chaque écran ne pousse
  // que la section qu'il édite.
  const merged: Prisma.JsonObject = { ...current, ...(validated.data as Prisma.JsonObject) };

  await prisma.setting.upsert({
    where: { key },
    create: { key, data: merged as Prisma.InputJsonValue, updatedAt: new Date() },
    update: { data: merged as Prisma.InputJsonValue, updatedAt: new Date() },
  });

  return { ok: true, data: merged };
});
