import type { Role } from "@/lib/types";
import type { Balance } from "../rh/types";

export type AccountRow = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: Role;
  jobTitle: string | null;
  photo: string | null;
  // Un compte non confirmé n'a pas encore de mot de passe réel : il ne peut pas
  // se connecter tant que la personne n'a pas cliqué le lien reçu.
  emailVerified: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  clientId: string | null;
  client: { id: string; name: string } | null;
};

export type AccountsScreen = {
  users: AccountRow[];
  clients: { id: string; name: string }[];
  // Soldes de l'équipe interne uniquement.
  balances: { userId: string; hours: Balance; leave: Balance }[];
};

export const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "DIR", label: "Direction", hint: "accès complet, valide les demandes" },
  { value: "PM", label: "Chefferie de projet", hint: "accès complet sauf pilotage" },
  { value: "DEV", label: "Développement", hint: "tickets, temps, RH, ressources" },
  { value: "CLIENT", label: "Client", hint: "portail client, un seul projet" },
];
