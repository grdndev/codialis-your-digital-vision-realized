import { adminRoute } from "@/lib/admin-api";
import { clientProjectId, portalEpics } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Avancement ».
export const GET = adminRoute(["CLIENT"], async ({ user }) => {
  const projectId = await clientProjectId(user.id);
  if (!projectId) return { epics: [] };

  return { epics: await portalEpics(projectId) };
}, { summary: "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Avancement : épics et leurs tickets, sans assigné ni temps." });
