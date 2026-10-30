import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { clientProjectId, portalEpics, portalOtherTickets, portalProjectParam } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

const querySchema = z.object({ project: portalProjectParam });

// Portail client — écran « Avancement » : les épics et leurs tickets, puis les
// tickets hors épic (CC-374), que l'avancement du projet compte aussi.
export const GET = adminRoute(["CLIENT"], async ({ user }, request) => {
  const query = parseQuery(querySchema, request);
  const projectId = await clientProjectId(user, query.project);
  if (!projectId) return { epics: [], others: [] };

  const [epics, others] = await Promise.all([portalEpics(projectId), portalOtherTickets(projectId)]);
  return { epics, others };
}, {
  summary:
    "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Avancement : épics et leurs tickets, puis tickets hors épic (`others`), sans assigné, temps ni estimation.",
  query: querySchema,
});
