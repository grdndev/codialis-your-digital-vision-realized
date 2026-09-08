import { adminRoute } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/tickets/new — les listes déroulantes du formulaire de création.
export const GET = adminRoute(["DEV", "PM", "DIR"], async () => {
  const [projects, team] = await Promise.all([
    prisma.project.findMany({
      include: { client: true, epics: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { role: { in: ["DEV", "PM"] } }, orderBy: { name: "asc" } }),
  ]);

  // Le formulaire n'a besoin que d'un libellé par projet et de ses épiques.
  return {
    projects: projects.map((p) => ({
      id: p.id,
      label: `${p.client.name} — ${p.name}`,
      epics: p.epics.map((e) => ({ id: e.id, title: e.title })),
    })),
    team: team.map((t) => ({ id: t.id, name: t.name })),
  };
});
