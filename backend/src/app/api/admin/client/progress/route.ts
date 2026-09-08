import { adminRoute } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Avancement ».
export const GET = adminRoute(["CLIENT"], async ({ user }) => {
  const projectId = await clientProjectId(user.id);
  if (!projectId) return { epics: [] };

  return {
    epics: await prisma.epic.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      include: { tasks: { orderBy: { order: "asc" } } },
    }),
  };
});
