import type { Role } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  // Autres chemins que cette entrée représente : l'écran « Rentabilité & temps »
  // a deux onglets sur deux routes, et le menu doit rester surligné sur les deux.
  alsoMatch?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["DIR", "PM", "DEV"] },
  { href: "/todo", label: "À traiter", roles: ["DIR"] },
  { href: "/projects", label: "Projets", roles: ["DEV", "PM", "DIR"] },
  { href: "/crm", label: "Prospection", roles: ["DIR", "PM"] },
  { href: "/triage", label: "Remontées client", roles: ["DIR", "PM"] },
  { href: "/resources", label: "Ressources", roles: ["DEV", "PM"] },
  { href: "/tickets", label: "Tickets", roles: ["DEV", "PM"] },
  { href: "/rh", label: "RH", roles: ["DEV", "PM", "DIR"] },
  { href: "/pilotage", label: "Pilotage", roles: ["DIR"] },
  // Rentabilité et Temps forment un seul écran à deux onglets, donc une seule
  // entrée de menu. La rentabilité restant réservée à la direction et à la
  // chefferie, un développeur n'a que l'onglet Temps — son entrée y mène
  // directement plutôt que de le faire rebondir sur un écran interdit.
  { href: "/finance", label: "Rentabilité & temps", roles: ["DIR", "PM"], alsoMatch: ["/time"] },
  { href: "/time", label: "Temps", roles: ["DEV"] },
  { href: "/maintenance", label: "Maintenance", roles: ["DIR", "PM"] },
  { href: "/automations", label: "Automatisations", roles: ["DIR", "PM"] },
  // Le site vitrine : ce qu'il publie, ses réglages, ce qu'il fait remonter.
  { href: "/site", label: "Contenu du site", roles: ["PM"] },
  { href: "/site/reglages", label: "Réglages du site", roles: ["DIR", "PM"] },
  { href: "/site/messages", label: "Demandes de contact", roles: ["DIR", "PM"] },
  { href: "/site/veille", label: "Veille", roles: ["DIR", "PM"] },
    // La chefferie gère les comptes au même titre que la direction : mêmes
  // droits, aucune restriction en écriture (demande du 22/09).
  { href: "/equipe", label: "Comptes", roles: ["DIR", "PM"] },
  { href: "/parametres", label: "Paramètres", roles: ["DEV", "PM", "DIR"] },
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
