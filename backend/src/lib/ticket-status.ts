import type { Role, TaskStatus } from "@prisma/client";

// Les deux statuts qui sortent un ticket du travail à faire : livré
// (TERMINE) ou abandonné (ANNULE, CC-372). Un ticket « ouvert » n'est ni
// l'un ni l'autre — c'est ce que comptent le Dashboard, la liste de l'écran
// Temps et le défaut de `lister_tickets`.
export const CLOSED_STATUSES: TaskStatus[] = ["TERMINE", "ANNULE"];

// Clôturer, c'est constater que le travail est bon ; annuler, décider qu'il
// ne se fera pas. Ni l'un ni l'autre ne revient à qui porte le ticket : un
// développeur va jusqu'à « En revue », la chefferie de projet et la direction
// ferment (DEC-007, CC-372). Renvoie le refus à afficher, ou null.
export function closureRefusal(status: TaskStatus, role: Role): string | null {
  if (role !== "DEV") return null;
  if (status === "TERMINE") return "La clôture revient à la chefferie de projet ou à la direction.";
  if (status === "ANNULE") return "L'annulation revient à la chefferie de projet ou à la direction.";
  return null;
}
