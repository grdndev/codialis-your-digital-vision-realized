import { adminRoute } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Rendez-vous ».
export const GET = adminRoute(["CLIENT"], async ({ user }) => {
  const projectId = await clientProjectId(user.id);
  if (!projectId) return { next: null, past: [], host: null };

  const [next, past, anyRdv] = await Promise.all([
    prisma.rdv.findFirst({
      where: { projectId, isPast: false },
      include: { host: true },
      orderBy: { whenAt: "asc" },
    }),
    prisma.rdv.findMany({ where: { projectId, isPast: true }, orderBy: { whenAt: "desc" } }),
    // L'animateur affiché en en-tête, même quand aucun rendez-vous n'est à venir.
    prisma.rdv.findFirst({ where: { projectId }, include: { host: true } }),
  ]);

  return {
    next,
    past,
    host: anyRdv?.host ? { id: anyRdv.host.id, name: anyRdv.host.name } : null,
  };
});
