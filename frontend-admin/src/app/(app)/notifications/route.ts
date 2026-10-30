import { NextResponse } from "next/server";
import { apiGet } from "@/lib/api";
import type { NotificationsResponse } from "@/lib/dto";

// GET /notifications — relais de la cloche de la barre du haut (CC-366).
//
// Une route plutôt qu'une action serveur : la cloche se relit à chaque
// changement de page, et Next exécute les actions serveur une à la fois — un
// formulaire envoyé pendant ce rafraîchissement attendrait derrière lui.
export async function GET() {
  const data = await apiGet<NotificationsResponse>("/api/admin/notifications");
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
