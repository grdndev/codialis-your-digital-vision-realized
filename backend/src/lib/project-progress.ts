import "server-only";
import { prisma } from "@/lib/prisma";

// `Project.progressPct` est une colonne stockée, relue directement par le
// dashboard, la liste des projets et le portail client — pas un calcul fait à
// chaque lecture. Il faut donc la rafraîchir dès qu'une tâche apparaît ou change
// d'état. Un projet sans tâche modélisée garde sa valeur : une liste vide n'est
// pas la preuve d'un avancement nul, seulement de ce qui n'est pas suivi à ce
// niveau de détail.
export async function recomputeProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { epic: { projectId } },
    select: { status: true },
  });
  if (tasks.length === 0) return;
  const done = tasks.filter((t) => t.status === "TERMINE").length;
  await prisma.project.update({
    where: { id: projectId },
    data: { progressPct: Math.round((done / tasks.length) * 100) },
  });
}
