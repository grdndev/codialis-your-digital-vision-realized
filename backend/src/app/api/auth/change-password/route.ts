import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password";
import { signSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

// POST /api/auth/change-password
//
// Sert au changement forcé de la première connexion comme au changement
// volontaire. Le mot de passe actuel est exigé dans les deux cas : une session
// volée ne doit pas suffire à verrouiller le compte de son propriétaire.
export const POST = adminRoute([], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Mot de passe actuel et nouveau requis");
  const { currentPassword, newPassword } = parsed.data;

  const problem = validatePassword(newPassword);
  if (problem) badRequest(problem);
  if (newPassword === currentPassword) badRequest("Le nouveau mot de passe doit être différent");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) badRequest("Mot de passe actuel incorrect");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      mustChangePassword: false,
    },
  });

  // Un jeton frais : celui en cours porte peut-être encore l'obligation de
  // changer de mot de passe, et le frontend le remplace par celui-ci.
  return { ok: true, token: await signSessionToken(user.id, user.role) };
});
