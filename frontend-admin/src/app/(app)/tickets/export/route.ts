import type { NextRequest } from "next/server";
import { apiGet } from "@/lib/api";
import { exportFileName, ticketsToCsv, ticketsToJson } from "@/lib/ticket-export";
import type { ExportFormat } from "@/lib/ticket-export";
import type { TicketsScreen } from "../types";

// GET /tickets/export — le fichier d'export des tickets (CC-353).
//
// Appelée par le formulaire « Exporter » de l'écran Tickets et de la fiche
// projet, en GET simple : la réponse part en pièce jointe, le navigateur
// télécharge sans quitter la page. Les critères arrivent en cases à cocher,
// donc en paramètres répétés (`status=A_FAIRE&status=EN_COURS`), et repartent
// vers l'API en listes séparées par des virgules. Aucun critère = tout.
//
// Les droits restent ceux de l'API, qui lit la même session : l'export ne sort
// rien que la liste des tickets ne montrerait pas.

function joined(params: URLSearchParams, key: string): string {
  return params.getAll(key).flatMap((v) => v.split(",")).filter(Boolean).join(",");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const format: ExportFormat = params.get("format") === "json" ? "json" : "csv";

  const query = new URLSearchParams();
  const project = joined(params, "project");
  const status = joined(params, "status");
  const assignee = joined(params, "assignee");
  if (project) query.set("project", project);
  if (status) query.set("status", status);
  // Sans personne cochée, `all` : l'écran Tickets filtre sur « Moi » par
  // défaut, un export sans critère doit au contraire tout rendre.
  query.set("assignee", assignee || "all");

  const { tickets } = await apiGet<TicketsScreen>(`/api/admin/tickets?${query}`);
  // Le tri par gravité de l'API sert l'écran ; un fichier se relit mieux dans
  // l'ordre des références.
  const sorted = [...tickets].sort((a, b) => a.ref.localeCompare(b.ref, "fr", { numeric: true }));

  const now = new Date();
  // Un export limité à un seul projet en porte le nom : plusieurs fichiers
  // téléchargés d'affilée restent reconnaissables.
  const scope = project && !project.includes(",") ? (sorted[0]?.project.name ?? null) : null;
  const body = format === "json" ? ticketsToJson(sorted, now) : ticketsToCsv(sorted);

  return new Response(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(scope, format, now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
