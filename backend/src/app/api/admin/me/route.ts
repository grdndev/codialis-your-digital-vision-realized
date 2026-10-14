import { z } from "zod";
import { adminRoute, badRequest, HttpError, parseBody, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SCHEDULE } from "@/lib/work-time";
import { API_TOKEN_DURATIONS, generateApiToken } from "@/lib/api-tokens";

export const dynamic = "force-dynamic";

// Couleurs du back-office qu'une personne peut changer pour elle-même (CC-353).
// Les noms sont ceux des variables CSS de frontend-admin (`--color-<nom>`) ;
// les couleurs d'état — alerte, erreur, information — n'y figurent pas, elles
// portent un sens qui doit rester le même pour toute l'équipe.
const THEME_KEYS = ["bg", "panel", "panel-2", "border", "text", "muted", "mint"] as const;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Relecture défensive : une valeur qui ne serait pas une couleur hexadécimale
// finirait telle quelle dans une feuille de style.
function readThemeColors(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const colors: Record<string, string> = {};
    for (const key of THEME_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && HEX_COLOR.test(value)) colors[key] = value.toLowerCase();
    }
    return Object.keys(colors).length ? colors : null;
  } catch {
    return null;
  }
}

// Au-delà, c'est qu'on en crée sans jamais en révoquer : mieux vaut le dire
// que laisser s'accumuler des accès dont plus personne ne sait où ils sont.
const MAX_API_TOKENS = 20;

const querySchema = z.object({
  tokens: z.string().optional().describe("`1` = joindre ses jetons d'API (`apiTokens`) et l'adresse de l'API (`apiUrl`)"),
});

// GET /api/admin/me — identité de la session, pour le bandeau et les gardes de
// rôle du frontend, plus les réglages personnels de l'écran Paramètres. Ni le
// hash du mot de passe ni les relations ne sortent.
//
// `user` garde exactement la forme qu'attendent les layouts : les réglages
// arrivent à côté, dans `settings`, pour ne pas alourdir la session. `theme`
// est à part parce que CHAQUE page le lit pour poser ses couleurs. Les jetons
// d'API ne sont lus que sur demande (`tokens=1`) : seul l'écran Paramètres en
// a l'usage, et chaque page appelle cette route.
export const GET = adminRoute([], async ({ user }, request) => {
  const withTokens = parseQuery(querySchema, request).tokens === "1" && user.role !== "CLIENT";

  // La réponse automatique d'absence est propre à la personne connectée
  // (`AbsenceSetting.pmId`) et ne concerne que celles qui suivent des clients.
  const absence =
    user.role === "PM" || user.role === "DIR"
      ? await prisma.absenceSetting.findUnique({
          where: { pmId: user.id },
          select: {
            mode: true,
            enabled: true,
            messageConges: true,
            messageHoraires: true,
          },
        })
      : null;

  // Les horaires de travail bornent le temps mesuré : un ticket laissé « en
  // cours » le soir ne compte pas la nuit. Sans réglage personnel, l'horaire
  // par défaut de l'agence s'applique — chacun peut le corriger.
  const schedule =
    user.role === "CLIENT" ? null : await prisma.workSchedule.findUnique({ where: { userId: user.id } });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
      role: user.role,
      clientId: user.clientId,
    },
    theme: readThemeColors(user.themeColors),
    settings: {
      jobTitle: user.jobTitle,
      photo: user.photo,
      absence,
      schedule:
        user.role === "CLIENT"
          ? null
          : {
              startMin: schedule?.startMin ?? DEFAULT_SCHEDULE.startMin,
              breakStartMin: schedule ? schedule.breakStartMin : DEFAULT_SCHEDULE.breakStartMin,
              breakEndMin: schedule ? schedule.breakEndMin : DEFAULT_SCHEDULE.breakEndMin,
              endMin: schedule?.endMin ?? DEFAULT_SCHEDULE.endMin,
              weekdays: schedule?.weekdays ?? DEFAULT_SCHEDULE.weekdays.join(","),
              // Vrai tant que la personne n'a rien réglé : l'écran le dit.
              isDefault: !schedule,
            },
    },
    ...(withTokens
      ? {
          // Jamais le jeton lui-même : il n'est montré qu'à sa création.
          apiTokens: await prisma.apiToken.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              prefix: true,
              readOnly: true,
              expiresAt: true,
              lastUsedAt: true,
              createdAt: true,
            },
          }),
          apiUrl: (process.env.API_URL || "https://landingback.codialis.com").replace(/\/$/, ""),
        }
      : {}),
  };
}, {
  summary:
    "Le compte appelant : identité (`user`), couleurs (`theme`), réglages personnels (`settings` : intitulé, photo, horaires, réponse d'absence). Avec `tokens=1` : ses jetons d'API.",
  query: querySchema,
});

const bodySchema = z.discriminatedUnion("action", [
  // L'intitulé et la photo s'affichent sous le nom dans la section « équipe »
  // du site vitrine. Chacun rédige les siens ; le rôle applicatif, lui, reste
  // à la direction. La photo est une data URL base64, comme les images du
  // site — pas de service de fichiers à héberger.
  z.object({
    action: z.literal("update-profile"),
    jobTitle: z.string().max(255).nullable(),
    photo: z.string().nullable().describe("Data URL base64"),
  }).describe("Intitulé et photo affichés dans la section « équipe » du site vitrine."),
  // Horaires de travail. Les minutes depuis minuit évitent tout fuseau : c'est
  // une heure locale de bureau, pas un instant. Aucune plage supplémentaire
  // n'est réglable ici : une soirée travaillée se déclare en RH, où elle est
  // validée et alimente le solde d'heures.
  z.object({
    action: z.literal("update-schedule"),
    startMin: z.number().int().min(0).max(1440),
    endMin: z.number().int().min(0).max(1440),
    breakStartMin: z.number().int().min(0).max(1440).nullable(),
    breakEndMin: z.number().int().min(0).max(1440).nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  }).describe("Horaires de travail en minutes depuis minuit, heure de La Réunion ; ils bornent le temps mesuré."),
  z.object({
    action: z.literal("set-absence-mode"),
    mode: z.enum(["OUVERT", "HORAIRES", "CONGES"]),
  }).describe("Mode de réponse automatique aux clients (PM, DIR)."),
  // Le message envoyé au client se rédige. Vide, le texte par défaut de
  // l'agence reprend sa place — c'est aussi la façon de revenir en arrière.
  z.object({
    action: z.literal("set-absence-message"),
    mode: z.enum(["HORAIRES", "CONGES"]),
    message: z.string().max(2000),
  }).describe("Texte de la réponse automatique ; vide = texte de l'agence (PM, DIR)."),
  z.object({ action: z.literal("toggle-absence-enabled") }).describe(
    "Active ou coupe la réponse automatique (PM, DIR).",
  ),
  // Seules les couleurs qui s'écartent de celles de l'agence sont envoyées ;
  // un objet vide revient aux couleurs par défaut.
  z.object({
    action: z.literal("set-theme-colors"),
    colors: z.partialRecord(z.enum(THEME_KEYS), z.string().regex(HEX_COLOR)),
  }).describe("Couleurs personnelles du back-office ; un objet vide revient aux couleurs de l'agence."),
  // Jetons d'API : depuis une SESSION seulement (voir plus bas).
  z.object({
    action: z.literal("create-api-token"),
    name: z.string().trim().min(1).max(100).describe("Pour le reconnaître : « Claude Code — portable »"),
    readOnly: z.boolean().default(false).describe("true = lecture seule (GET)"),
    duration: z
      .enum(Object.keys(API_TOKEN_DURATIONS) as [keyof typeof API_TOKEN_DURATIONS])
      .default("90")
      .describe("Durée de validité en jours (30, 90, 365) ou `jamais`"),
  }).describe(
    "Crée un jeton d'API personnel. Renvoie le jeton en clair (`token`), qui n'est plus jamais montré ensuite. Session seulement.",
  ),
  z.object({ action: z.literal("revoke-api-token"), tokenId: z.string().min(1) }).describe(
    "Révoque un de ses jetons d'API. Session seulement.",
  ),
]);

// POST /api/admin/me — ses propres réglages, jamais ceux d'un autre : la clé
// vient toujours de la session, jamais du corps de la requête.
export const POST = adminRoute([], async ({ user, auth }, request) => {
  const body = await parseBody(bodySchema, request);

  // Un compte client n'a ni intitulé sur le site vitrine ni réponse d'absence.
  if (user.role === "CLIENT") badRequest("Réglage indisponible sur un compte client");

  switch (body.action) {
    // Un jeton ne gère pas les jetons : volé, il pourrait sinon s'en créer un
    // autre, sans expiration, qui survivrait à sa propre révocation. C'est la
    // session — donc le mot de passe — qui en décide.
    case "create-api-token": {
      if (auth.via !== "session") {
        throw new HttpError("Les jetons d'API se créent depuis le back-office (Paramètres)", 403);
      }
      const count = await prisma.apiToken.count({ where: { userId: user.id } });
      if (count >= MAX_API_TOKENS) {
        badRequest(`${MAX_API_TOKENS} jetons au plus : révoquez ceux qui ne servent plus`);
      }
      const days = API_TOKEN_DURATIONS[body.duration];
      const { raw, hash, prefix } = generateApiToken();
      const created = await prisma.apiToken.create({
        data: {
          userId: user.id,
          name: body.name,
          tokenHash: hash,
          prefix,
          readOnly: body.readOnly,
          expiresAt: days === null ? null : new Date(Date.now() + days * 86_400_000),
        },
        select: { id: true },
      });
      return { ok: true, id: created.id, token: raw, prefix };
    }

    case "revoke-api-token": {
      if (auth.via !== "session") {
        throw new HttpError("Les jetons d'API se révoquent depuis le back-office (Paramètres)", 403);
      }
      // Bornée au propriétaire : l'identifiant d'un jeton d'autrui ne révoque
      // rien (la chefferie et la direction passent par l'écran Comptes).
      const { count } = await prisma.apiToken.deleteMany({
        where: { id: body.tokenId, userId: user.id },
      });
      if (count === 0) badRequest("Jeton introuvable");
      return;
    }

    case "update-profile": {
      const jobTitle = body.jobTitle?.trim();
      const photo = body.photo?.trim();
      await prisma.user.update({
        where: { id: user.id },
        data: { jobTitle: jobTitle || null, photo: photo || null },
      });
      return;
    }

    case "update-schedule": {
      if (body.endMin <= body.startMin) badRequest("La fin doit suivre le début");
      // Une pause incomplète ou à l'envers ne borne rien : on n'en garde une
      // que si elle tient debout.
      const hasBreak =
        body.breakStartMin !== null &&
        body.breakEndMin !== null &&
        body.breakEndMin > body.breakStartMin;
      const data = {
        startMin: body.startMin,
        endMin: body.endMin,
        breakStartMin: hasBreak ? body.breakStartMin : null,
        breakEndMin: hasBreak ? body.breakEndMin : null,
        weekdays: [...new Set(body.weekdays)].sort((a, b) => a - b).join(","),
      };
      await prisma.workSchedule.upsert({
        where: { userId: user.id },
        update: data,
        create: { userId: user.id, ...data },
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

    case "set-absence-message": {
      if (user.role !== "PM" && user.role !== "DIR") {
        badRequest("Réservé aux comptes qui suivent des clients");
      }
      const text = body.message.trim() || null;
      const data =
        body.mode === "CONGES" ? { messageConges: text } : { messageHoraires: text };
      await prisma.absenceSetting.upsert({
        where: { pmId: user.id },
        update: data,
        create: { pmId: user.id, ...data },
      });
      return;
    }

    case "set-theme-colors": {
      const colors = Object.fromEntries(
        Object.entries(body.colors).map(([key, value]) => [key, value.toLowerCase()]),
      );
      await prisma.user.update({
        where: { id: user.id },
        data: { themeColors: Object.keys(colors).length ? JSON.stringify(colors) : null },
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
}, {
  summary:
    "Ses propres réglages (jamais ceux d'un autre) : profil, horaires, réponse d'absence, couleurs, jetons d'API.",
  body: bodySchema,
});
