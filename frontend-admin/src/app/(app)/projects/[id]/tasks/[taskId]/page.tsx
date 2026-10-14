import { notFound, redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { TicketDetailResponse } from "../../../../tickets/types";

// Ancienne adresse d'une tâche. Les tâches sont devenues des tickets sous le
// MÊME identifiant (CC-365) : un lien gardé dans un favori, un commentaire ou
// un message mène ainsi au ticket qui l'a remplacée.
export default async function OldTaskRedirect({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { taskId } = await params;
  const { ticket } = await apiGet<TicketDetailResponse>(
    `/api/admin/tickets/detail?id=${encodeURIComponent(taskId)}`,
  );
  if (!ticket) notFound();
  redirect(`/tickets/${ticket.ref}`);
}
