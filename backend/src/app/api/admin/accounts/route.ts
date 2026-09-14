import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendVerifyEmail } from "@/lib/mail";
import { EMAIL_RE } from "@/lib/public-api";
import { availableHours, availableLeave } from "@/lib/balances";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;
const ROLES = ["DIR", "PM", "DEV", "CLIENT"] as const;

// Gestion des comptes — direction uniquement.
//
// Un compte se crée SANS mot de passe : il démarre non confirmé, avec un hash
// aléatoire que personne ne connaît, et un lien d'invitation part par e-mail.
// La personne choisit elle-même son mot de passe au bout du lien (voir
// /api/auth/verify). L'adresse est donc prouvée sans qu'aucun identifiant n'ait
// à quitter le serveur.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const GET = adminRoute(["DIR"], async () => {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      initials: true,
      role: true,
      jobTitle: true,
      photo: true,
      emailVerified: true,
      mustChangePassword: true,
      createdAt: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  });

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Les soldes ne concernent que l'équipe interne.
  const balances = await Promise.all(
    users
      .filter((u) => u.role !== "CLIENT")
      .map(async (u) => ({
        userId: u.id,
        hours: await availableHours(u.id),
        leave: await availableLeave(u.id),
      })),
  );

  return { users, clients, balances };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().min(1).max(200),
    email: z.string().min(1).max(320),
    role: z.enum(ROLES),
    jobTitle: z.string().nullable(),
    clientId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("update"),
    userId: z.string().min(1),
    name: z.string().min(1).max(200),
    email: z.string().min(1).max(320),
    role: z.enum(ROLES),
    jobTitle: z.string().nullable(),
    photo: z.string().nullable(),
    clientId: z.string().nullable(),
  }),
  z.object({ action: z.literal("delete"), userId: z.string().min(1) }),
  z.object({ action: z.literal("resend-verify"), userId: z.string().min(1) }),
]);

// La dernière direction ne doit pas pouvoir se supprimer ni se rétrograder :
// sans elle, plus personne ne peut gérer les comptes.
async function assertNotLastDirector(userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role !== "DIR") return;
  const directors = await prisma.user.count({ where: { role: "DIR" } });
  if (directors <= 1) badRequest("Impossible : c'est le dernier compte de direction");
}

export const POST = adminRoute(["DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "delete") {
    if (body.userId === user.id) badRequest("Vous ne pouvez pas supprimer votre propre compte");
    await assertNotLastDirector(body.userId);
    await prisma.user.delete({ where: { id: body.userId } });
    return;
  }

  if (body.action === "resend-verify") {
    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        mustChangePassword: true,
      },
    });
    if (!target) notFound("Compte introuvable");
    // Renvoyable tant que la personne n'a pas posé son propre mot de passe —
    // `mustChangePassword` marque les comptes ouverts avant l'invitation, à qui
    // un mot de passe provisoire avait été envoyé. Une fois le mot de passe
    // choisi, c'est « mot de passe oublié » qui prend le relais : sinon la
    // route servirait à réémettre des accès à répétition.
    if (target.emailVerified && !target.mustChangePassword) {
      badRequest("Ce compte a déjà défini son mot de passe");
    }

    try {
      const token = await createToken(target.id, "VERIFY");
      await sendVerifyEmail({ name: target.name, email: target.email, role: target.role, token });
    } catch (err) {
      console.error("Renvoi du lien d'invitation en échec:", err);
      badRequest("Échec de l'envoi de l'e-mail — réessayez");
    }
    return;
  }

  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) badRequest("Adresse e-mail invalide");
  const name = body.name.trim();
  // Un compte client doit être rattaché à un client, sinon son portail n'a
  // aucun périmètre.
  if (body.role === "CLIENT" && !body.clientId) badRequest("Un compte client doit être rattaché à un client");

  if (body.action === "update") {
    const duplicate = await prisma.user.findFirst({
      where: { email, id: { not: body.userId } },
      select: { id: true },
    });
    if (duplicate) badRequest("Cette adresse est déjà utilisée");

    // Rétrograder la dernière direction reviendrait à se verrouiller dehors.
    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { role: true },
    });
    if (!target) notFound("Compte introuvable");
    if (target.role === "DIR" && body.role !== "DIR") await assertNotLastDirector(body.userId);

    await prisma.user.update({
      where: { id: body.userId },
      data: {
        name,
        initials: initialsOf(name),
        email,
        role: body.role,
        jobTitle: body.jobTitle,
        photo: body.photo,
        clientId: body.role === "CLIENT" ? body.clientId : null,
      },
    });
    return;
  }

  const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (duplicate) badRequest("Cette adresse est déjà utilisée");

  // Hash aléatoire : aucune connexion ne peut y correspondre tant que le vrai
  // mot de passe n'a pas été engendré à la confirmation.
  const placeholder = await bcrypt.hash(randomBytes(24).toString("hex"), BCRYPT_ROUNDS);

  const created = await prisma.user.create({
    data: {
      name,
      initials: initialsOf(name),
      email,
      role: body.role,
      jobTitle: body.jobTitle,
      passwordHash: placeholder,
      emailVerified: false,
      mustChangePassword: false,
      clientId: body.role === "CLIENT" ? body.clientId : null,
    },
    select: { id: true },
  });

  try {
    const token = await createToken(created.id, "VERIFY");
    await sendVerifyEmail({ name, email, role: body.role, token });
  } catch (err) {
    // Si l'e-mail ne part pas, on annule la création : laisser un compte non
    // confirmé que personne ne peut activer n'aide personne.
    console.error("Envoi du lien d'invitation en échec:", err);
    await prisma.user.delete({ where: { id: created.id } });
    badRequest("Échec de l'envoi de l'e-mail — compte non créé");
  }

  return { ok: true, id: created.id, pending: true };
});
