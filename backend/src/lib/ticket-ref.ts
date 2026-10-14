import "server-only";
import { badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// Un ticket se désigne par son identifiant OU par sa référence (« CC-365 »).
//
// L'écran manipule des identifiants ; une personne, un script ou un agent
// pense en références — c'est ce qui figure dans les échanges, les commits et
// les adresses du back-office. Les deux formes ne se confondent pas : un
// identifiant est un cuid (minuscules et chiffres, sans tiret), une référence
// est un préfixe de projet, un tiret et un numéro.

const REF = /^[A-Za-z0-9]+-\d+$/;

export function looksLikeTicketRef(value: string): boolean {
  return REF.test(value);
}

export async function ticketIdOf(idOrRef: string): Promise<string> {
  if (!looksLikeTicketRef(idOrRef)) return idOrRef;
  const ticket = await prisma.ticket.findUnique({ where: { ref: idOrRef }, select: { id: true } });
  if (!ticket) badRequest(`Ticket introuvable : ${idOrRef}`);
  return ticket.id;
}

// Remplace, dans un corps déjà validé, `ticketId` et `ticketIds` donnés en
// référence par les identifiants correspondants. Tout le reste de la route
// continue de ne connaître que des identifiants.
export async function withTicketIds<T extends object>(body: T): Promise<T> {
  const next: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  if (typeof next.ticketId === "string") next.ticketId = await ticketIdOf(next.ticketId);
  if (Array.isArray(next.ticketIds)) {
    next.ticketIds = await Promise.all(
      next.ticketIds.map((v) => (typeof v === "string" ? ticketIdOf(v) : v)),
    );
  }
  return next as T;
}

export const TICKET_ID_DESCRIPTION = "Identifiant du ticket, ou sa référence (ex. « CC-365 »)";
