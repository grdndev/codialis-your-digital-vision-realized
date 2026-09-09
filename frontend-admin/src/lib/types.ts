// Énumérations du domaine, dupliquées depuis `backend/prisma/schema.prisma`.
//
// frontend-admin ne dépend plus de Prisma : il ne parle au backend qu'en HTTP,
// et n'a donc plus accès aux types générés par `@prisma/client`. Ces unions de
// chaînes sont l'équivalent structurel exact des `enum` du schéma — les valeurs
// arrivent telles quelles dans le JSON de l'API.
//
// Toute modification d'un `enum` côté schéma doit être répercutée ici. C'est le
// prix de la séparation : le seul contrat entre les deux applications est le
// JSON de l'API, pas un paquet partagé.

export type Role = "DIR" | "PM" | "DEV" | "CLIENT";
export type ProjectGroup = "DEV" | "FIN" | "WAR" | "MAI" | "CLO";
export type TaskStatus = "A_FAIRE" | "EN_COURS" | "EN_REVUE" | "TERMINE";
export type TicketType = "BUG" | "DEV";
export type Severity = "BLOQUANT" | "MAJEUR" | "MINEUR";
export type DevNature = "FRONT" | "BACK" | "API" | "DESIGN";
export type TriageState = "A_QUALIFIER" | "A_CHIFFRER" | "TRANSMIS" | "DEVIS_ENVOYE" | "CLOS";
export type DealStage = "CONTACT" | "QUALIFIE" | "DEVIS" | "NEGOCIATION" | "SIGNE" | "REFUSE";
export type ThreadKind = "PROJECT" | "DIRECT" | "INTERNAL";
export type ClientQuestionStatus = "A_DEMANDER" | "DEMANDE" | "REPONDU";
export type MockupStatus = "VALIDE" | "EN_INTEGRATION" | "A_VALIDER" | "BROUILLON";
export type CategoryVisibility = "TEAM" | "PM_ONLY";
export type CategoryFormat = "TABLE" | "FILES" | "NOTES";
export type InvoiceStatus = "EN_ATTENTE" | "EN_RETARD" | "PAYEE";
export type AutomationMode = "AUTO" | "TO_VALIDATE";
export type DraftStatus = "PENDING" | "SENT" | "IGNORED";
export type AbsenceMode = "OUVERT" | "HORAIRES" | "CONGES";
export type HrEntryStatus = "DECLARE" | "VALIDE" | "REFUSE";
export type ShiftKind = "BUREAU" | "TELETRAVAIL" | "CLIENT" | "ABSENCE";
export type ActionCategory = "URGENT" | "RELANCE" | "DECISION";

// L'utilisateur connecté, tel que le renvoie GET /api/admin/me. Sous-ensemble
// volontaire du modèle `User` : ni le hash du mot de passe ni les relations.
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: Role;
  clientId: string | null;
};
