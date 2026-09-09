import type { Role } from "@/lib/types";

export type NavItem = { href: string; label: string; roles: Role[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["DIR", "PM"] },
  { href: "/todo", label: "À traiter", roles: ["DIR"] },
  { href: "/projects", label: "Projets", roles: ["DIR", "PM"] },
  { href: "/crm", label: "Prospection", roles: ["DIR", "PM"] },
  { href: "/triage", label: "Remontées client", roles: ["DIR", "PM"] },
  { href: "/messages", label: "Messagerie", roles: ["DEV", "PM", "DIR"] },
  { href: "/resources", label: "Ressources", roles: ["DEV", "PM", "DIR"] },
  { href: "/tickets", label: "Tickets", roles: ["DEV", "PM", "DIR"] },
  { href: "/time", label: "Temps", roles: ["DEV", "PM", "DIR"] },
  { href: "/rh", label: "RH", roles: ["DEV", "PM", "DIR"] },
  { href: "/pilotage", label: "Pilotage", roles: ["DIR"] },
  { href: "/finance", label: "Rentabilité", roles: ["DIR", "PM"] },
  { href: "/maintenance", label: "Maintenance", roles: ["DIR", "PM"] },
  { href: "/automations", label: "Automatisations", roles: ["DIR", "PM"] },
  // Le site vitrine : ce qu'il publie, ses réglages, ce qu'il fait remonter.
  { href: "/site", label: "Contenu du site", roles: ["DIR", "PM"] },
  { href: "/site/reglages", label: "Réglages du site", roles: ["DIR", "PM"] },
  { href: "/site/messages", label: "Retours du site", roles: ["DIR", "PM"] },
  { href: "/site/veille", label: "Veille", roles: ["DIR", "PM"] },
  { href: "/equipe", label: "Comptes", roles: ["DIR"] },
  { href: "/mot-de-passe", label: "Mon mot de passe", roles: ["DEV", "PM", "DIR"] },
];

export const CLIENT_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/portal", label: "Avancement" },
  { href: "/portal/bugs", label: "Signalements" },
  { href: "/portal/project", label: "Mon projet" },
  { href: "/portal/rdv", label: "Rendez-vous" },
  { href: "/portal/messages", label: "Échanges" },
];

export const ROLE_LABEL: Record<Role, string> = {
  DIR: "Dirigeante",
  PM: "Cheffe de projet",
  DEV: "Développeur·se",
  CLIENT: "Client",
};

export function defaultPathFor(role: Role): string {
  if (role === "DEV") return "/tickets";
  if (role === "CLIENT") return "/portal";
  return "/dashboard";
}
