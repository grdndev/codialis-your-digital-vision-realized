// Seed data ported from the Claude Design prototype (Codialis CRM.dc.html):
// ALL_PROJECTS, PROJECT_EPICS (Aiva), TF_EPICS (Top Formation), DEVQ (tickets),
// TICKET_EPICS / MODULE_EPIC, TICKET_DETAIL, REVIEW_NOTES, ROLES / WHO.
import { PrismaClient, ProjectGroup, TaskStatus, TicketType, Severity, DevNature } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "codialis2026";

function hoursFr(s: string): number {
  const m = /([\d,.]+)/.exec(s);
  if (!m) return 0;
  return parseFloat(m[1].replace(",", "."));
}

function d(iso: string): Date {
  return new Date(`${iso}T09:00:00.000Z`);
}

async function main() {
  console.log("Seeding…");
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // ---------- Clients ----------
  const clientDefs: { name: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null }[] = [
    { name: "Aiva", contactName: "Karim Haddad", contactEmail: "karim.haddad@aiva.fr", contactPhone: "06 12 34 56 78" },
    { name: "Top Formation", contactName: "Sophie Renard", contactEmail: "sophie@topformation.fr", contactPhone: "06 45 12 78 90" },
    { name: "Tapix", contactName: "Nadia Ferrand", contactEmail: "nadia@tapix.fr", contactPhone: "07 23 56 89 01" },
    { name: "NCD", contactName: "Marc Le Gall", contactEmail: "marc@ncd.fr", contactPhone: "06 78 90 12 34" },
    { name: "Mois du Ker", contactName: null, contactEmail: null, contactPhone: null },
    { name: "Oxy", contactName: "Paul Adam", contactEmail: "paul.adam@oxy.fr", contactPhone: "06 34 56 78 90" },
    { name: "Selva", contactName: "Élodie Marchand", contactEmail: "elodie.marchand@selva.fr", contactPhone: "07 11 22 33 44" },
    { name: "Boulangerie Vasseur", contactName: "Julien Vasseur", contactEmail: "julien@boulangerie-vasseur.fr", contactPhone: "06 55 66 77 88" },
    { name: "Chalvin & Fils", contactName: null, contactEmail: null, contactPhone: null },
  ];
  const clients: Record<string, Awaited<ReturnType<typeof prisma.client.create>>> = {};
  for (const c of clientDefs) {
    clients[c.name] = await prisma.client.create({ data: c });
  }

  // ---------- Users ----------
  const claire = await prisma.user.create({
    data: { email: "claire@codialis.fr", passwordHash, name: "Claire Vasseur", initials: "CV", role: "DIR" },
  });
  const marion = await prisma.user.create({
    data: { email: "marion@codialis.fr", passwordHash, name: "Marion Lefèvre", initials: "ML", role: "PM" },
  });
  const lea = await prisma.user.create({
    data: { email: "lea@codialis.fr", passwordHash, name: "Léa Mercier", initials: "LM", role: "DEV" },
  });
  const karim = await prisma.user.create({
    data: { email: "karim@codialis.fr", passwordHash, name: "Karim Belkacem", initials: "KB", role: "DEV" },
  });

  // ---------- Projects ----------
  // proj(client, name, initials, group, phaseLabel, opened, closed, hoursSold, hoursSpent, pct, lastActivity, deadlineAt, deadlineNote, desc)
  type ProjDef = {
    client: string; name: string; initials: string; group: ProjectGroup; phaseLabel: string;
    opened: Date; closed: Date | null; hoursSold: number; hoursSpent: number; pct: number;
    lastActivity: Date; deadlineAt: Date | null; deadlineNote: string | null; desc: string;
  };
  const projectDefs: ProjDef[] = [
    { client: "Aiva", name: "Refonte plateforme", initials: "AV", group: "DEV", phaseLabel: "Développement",
      opened: d("2026-06-04"), closed: null, hoursSold: 300, hoursSpent: 214, pct: 68,
      lastActivity: d("2026-08-28"), deadlineAt: d("2026-09-18"), deadlineNote: null,
      desc: "Refonte complète de la plateforme de vente : catalogue, tunnel d’inscription en trois étapes, paiement Stripe et espace client. Reprise des données de l’ancien back-office." },
    { client: "Top Formation", name: "Plateforme e-learning", initials: "TF", group: "DEV", phaseLabel: "Développement",
      opened: d("2026-05-12"), closed: null, hoursSold: 260, hoursSpent: 188, pct: 62,
      lastActivity: d("2026-08-28"), deadlineAt: d("2026-09-30"), deadlineNote: null,
      desc: "Plateforme de formation en ligne : dix parcours modulaires, suivi de progression, attestations et espace formateur. Lecteur vidéo avec reprise de lecture." },
    { client: "Tapix", name: "App mobile V2", initials: "TX", group: "DEV", phaseLabel: "Développement",
      opened: d("2026-07-02"), closed: null, hoursSold: 110, hoursSpent: 96, pct: 41,
      lastActivity: d("2026-08-27"), deadlineAt: d("2026-09-05"), deadlineNote: null,
      desc: "Deuxième version de l’application : refonte de l’écran profil, notifications push et mode hors ligne. iOS et Android." },
    { client: "NCD", name: "Portail fournisseurs", initials: "NC", group: "DEV", phaseLabel: "Recette",
      opened: d("2026-02-18"), closed: null, hoursSold: 160, hoursSpent: 142, pct: 88,
      lastActivity: d("2026-08-28"), deadlineAt: d("2026-08-29"), deadlineNote: null,
      desc: "Portail de commande pour les 80 fournisseurs : dépôt de devis, génération de PDF, export mensuel et validation à deux niveaux." },
    { client: "Mois du Ker", name: "Site événementiel", initials: "MK", group: "DEV", phaseLabel: "Développement",
      opened: d("2026-06-09"), closed: null, hoursSold: 90, hoursSpent: 54, pct: 27,
      lastActivity: d("2026-08-26"), deadlineAt: d("2026-10-12"), deadlineNote: null,
      desc: "Site de l’édition 2026 : programme, billetterie externalisée, carte des lieux et espace presse. Trafic concentré sur trois semaines." },
    { client: "Oxy", name: "Refonte identité & site", initials: "OX", group: "DEV", phaseLabel: "Cadrage",
      opened: d("2026-08-11"), closed: null, hoursSold: 25, hoursSpent: 31, pct: 15,
      lastActivity: d("2026-08-24"), deadlineAt: d("2026-10-20"), deadlineNote: null,
      desc: "Nouvelle identité visuelle et site vitrine. Périmètre en cours de recadrage : le budget vendu est déjà dépassé de 6 h." },
    { client: "NCD", name: "Extranet transporteurs", initials: "NC", group: "FIN", phaseLabel: "Recette validée",
      opened: d("2026-01-06"), closed: d("2026-08-21"), hoursSold: 100, hoursSpent: 96, pct: 100,
      lastActivity: d("2026-08-23"), deadlineAt: null, deadlineNote: "bascule à décider",
      desc: "Suivi des enlèvements pour les transporteurs partenaires. Recette validée par le client le 21 août : reste à choisir entre garantie simple et contrat de maintenance." },
    { client: "Mois du Ker", name: "Site événementiel", initials: "MK", group: "FIN", phaseLabel: "Livré",
      opened: d("2026-03-03"), closed: d("2026-08-12"), hoursSold: 78, hoursSpent: 82, pct: 100,
      lastActivity: d("2026-08-20"), deadlineAt: null, deadlineNote: "garantie à ouvrir",
      desc: "Site de l’édition 2026 : programme, billetterie et plan du site. Livré avec 4 h de dépassement, garantie de 90 jours à ouvrir." },
    { client: "Boulangerie Vasseur", name: "Site vitrine & commande", initials: "BV", group: "WAR", phaseLabel: "Garantie",
      opened: d("2026-03-03"), closed: d("2026-07-14"), hoursSold: 80, hoursSpent: 78, pct: 100,
      lastActivity: d("2026-08-25"), deadlineAt: d("2026-10-12"), deadlineNote: null,
      desc: "Site vitrine avec commande de pains et pâtisseries en click and collect, gestion des créneaux de retrait." },
    { client: "Selva", name: "Refonte catalogue", initials: "SE", group: "WAR", phaseLabel: "Garantie",
      opened: d("2026-01-20"), closed: d("2026-06-02"), hoursSold: 110, hoursSpent: 112, pct: 100,
      lastActivity: d("2026-08-22"), deadlineAt: d("2026-08-31"), deadlineNote: null,
      desc: "Refonte du catalogue produits avec recherche Algolia et fiches enrichies. Contrat de maintenance à proposer avant la fin de garantie." },
    { client: "Chalvin & Fils", name: "Maintenance site + hébergement", initials: "CF", group: "MAI", phaseLabel: "Contrat 450 €/mois",
      opened: d("2025-03-04"), closed: d("2025-06-18"), hoursSold: 4, hoursSpent: 3, pct: 100,
      lastActivity: d("2026-08-23"), deadlineAt: d("2027-03-01"), deadlineNote: "renouvellement",
      desc: "Maintenance corrective et évolutive du site, hébergement et sauvegardes. Quatre heures incluses par mois." },
    { client: "NCD", name: "TMA portail fournisseurs", initials: "NC", group: "MAI", phaseLabel: "Contrat 550 €/mois",
      opened: d("2026-01-06"), closed: null, hoursSold: 5, hoursSpent: 7, pct: 100,
      lastActivity: d("2026-08-27"), deadlineAt: d("2026-12-31"), deadlineNote: "à renouveler",
      desc: "Tierce maintenance applicative du portail : correctifs, petites évolutions et support aux utilisateurs. Cinq heures par mois." },
    { client: "Mois du Ker", name: "Astreinte événementielle", initials: "MK", group: "MAI", phaseLabel: "Contrat 250 €/mois",
      opened: d("2026-06-01"), closed: null, hoursSold: 2, hoursSpent: 1, pct: 100,
      lastActivity: d("2026-08-19"), deadlineAt: d("2026-10-31"), deadlineNote: null,
      desc: "Astreinte pendant l’événement : intervention sous deux heures en cas d’incident, deux heures incluses par mois." },
    { client: "Tapix", name: "Site vitrine V1", initials: "TX", group: "CLO", phaseLabel: "Clôturé",
      opened: d("2025-09-07"), closed: d("2026-01-15"), hoursSold: 134, hoursSpent: 134, pct: 100,
      lastActivity: d("2026-01-15"), deadlineAt: null, deadlineNote: null,
      desc: "Premier site de la marque : présentation des produits et formulaire de contact. Remplacé par l’application mobile." },
    { client: "Aiva", name: "Audit technique", initials: "AV", group: "CLO", phaseLabel: "Clôturé",
      opened: d("2026-04-02"), closed: d("2026-04-30"), hoursSold: 22, hoursSpent: 22, pct: 100,
      lastActivity: d("2026-04-30"), deadlineAt: null, deadlineNote: null,
      desc: "Audit de l’ancienne plateforme avant refonte : dette technique, performances et sécurité. A servi de base au cahier des charges." },
    { client: "Top Formation", name: "Landing page lancement", initials: "TF", group: "CLO", phaseLabel: "Clôturé",
      opened: d("2026-01-14"), closed: d("2026-02-28"), hoursSold: 46, hoursSpent: 46, pct: 100,
      lastActivity: d("2026-02-28"), deadlineAt: null, deadlineNote: null,
      desc: "Page de lancement avec inscription à la liste d’attente, en amont de la plateforme e-learning." },
  ];

  const projects: Record<string, Awaited<ReturnType<typeof prisma.project.create>>[]> = {};
  for (const p of projectDefs) {
    const created = await prisma.project.create({
      data: {
        clientId: clients[p.client].id,
        name: p.name,
        initials: p.initials,
        group: p.group,
        phaseLabel: p.phaseLabel,
        description: p.desc,
        hoursSold: p.hoursSold,
        hoursSpent: p.hoursSpent,
        progressPct: p.pct,
        openedAt: p.opened,
        closedAt: p.closed,
        deadlineAt: p.deadlineAt,
        deadlineNote: p.deadlineNote,
        lastActivityAt: p.lastActivity,
      },
    });
    (projects[p.client] ??= []).push(created);
  }
  const aiva = projects["Aiva"][0];
  const topFormation = projects["Top Formation"][0];
  const tapix = projects["Tapix"][0];
  const ncd = projects["NCD"][0];
  const moisDuKer = projects["Mois du Ker"][0];
  const oxy = projects["Oxy"][0];

  // ---------- Project assignments ----------
  const activeDevProjects = [aiva, topFormation, tapix, ncd, moisDuKer, oxy];
  for (const proj of activeDevProjects) {
    await prisma.projectAssignment.create({ data: { projectId: proj.id, userId: marion.id } });
    await prisma.projectAssignment.create({ data: { projectId: proj.id, userId: claire.id } });
  }
  for (const proj of [aiva, topFormation, tapix]) {
    await prisma.projectAssignment.create({ data: { projectId: proj.id, userId: lea.id } });
  }
  for (const proj of [aiva, topFormation, ncd, tapix, oxy]) {
    await prisma.projectAssignment.create({ data: { projectId: proj.id, userId: karim.id } });
  }

  // ---------- Epics + tasks: Aiva ----------
  type TaskDef = { title: string; who: "Karim" | "Léa" | "Marion"; status: TaskStatus; est: number; spent: number; due: string; desc: string };
  const T = (title: string, who: TaskDef["who"], statusFr: string, est: string, spent: string, due: string, desc: string): TaskDef => ({
    title, who,
    status: statusFr === "Terminé" ? "TERMINE" : statusFr === "En revue" ? "EN_REVUE" : statusFr === "En cours" ? "EN_COURS" : "A_FAIRE",
    est: hoursFr(est), spent: spent === "—" ? 0 : hoursFr(spent), due, desc,
  });
  const userByFirst = { Karim: karim, Léa: lea, Marion: marion } as const;

  const aivaEpics: { title: string; lead: "Karim" | "Léa" | "Marion"; est: number; tasks: TaskDef[] }[] = [
    { title: "Socle technique et authentification", lead: "Karim", est: 52, tasks: [
      T("Authentification et rôles", "Karim", "Terminé", "14 h", "13 h", "2026-08-12", "Connexion e-mail, mot de passe oublié et trois rôles : client, vendeur, administrateur. Sessions persistantes 30 jours."),
      T("Mise en place de l’environnement de préprod", "Karim", "Terminé", "8 h", "7 h", "2026-06-20", "Serveur, base de données, déploiement automatique depuis la branche principale et sauvegardes quotidiennes."),
      T("Navigation et en-tête responsive", "Léa", "Terminé", "6 h", "6 h", "2026-07-02", "En-tête fixe avec menu déroulant, adapté mobile et tablette. Fil d’ariane sur les pages profondes."),
      T("Migration des données de l’ancien back-office", "Karim", "Terminé", "18 h", "17 h", "2026-07-28", "Reprise des 4 200 comptes clients et de l’historique de commandes, avec script de vérification."),
      T("Journalisation et remontée d’erreurs", "Karim", "Terminé", "6 h", "5 h", "2026-08-05", "Capture des erreurs serveur et navigateur, alerte par e-mail au-delà de dix occurrences par heure."),
    ]},
    { title: "Design et parcours", lead: "Karim", est: 46, tasks: [
      T("Maquettes des 8 écrans clés", "Karim", "Terminé", "20 h", "18 h", "2026-08-05", "Accueil, catalogue, fiche produit, panier, inscription, paiement, confirmation et espace client. Validées par le client le 8 juillet."),
      T("Design system : couleurs, typo, composants", "Karim", "Terminé", "12 h", "13 h", "2026-07-18", "Palette, échelle typographique et composants de base : boutons, champs, cartes, tableaux."),
      T("États vides et messages d’erreur", "Karim", "En cours", "5 h", "2 h", "2026-09-01", "Panier vide, recherche sans résultat, erreur de paiement. Illustration légère et action de sortie sur chaque état."),
      T("Déclinaison mobile des parcours", "Karim", "Terminé", "9 h", "11 h", "2026-08-12", "Adaptation des huit écrans en 375 px, avec navigation par onglets en bas."),
    ]},
    { title: "Catalogue et recherche", lead: "Léa", est: 58, tasks: [
      T("Intégration Algolia et indexation", "Léa", "Terminé", "16 h", "15 h", "2026-07-30", "Index des produits synchronisé à chaque modification, recherche à la frappe avec tolérance aux fautes."),
      T("Filtres par catégorie, prix et disponibilité", "Léa", "Terminé", "14 h", "14 h", "2026-08-08", "Filtres combinables, compteur de résultats en direct et conservation des filtres dans l’URL."),
      T("Tableau de bord utilisateur", "Léa", "En revue", "8 h", "7 h", "2026-08-27", "Vue d’ensemble du compte : dernières commandes, adresses enregistrées et suivi de livraison."),
      T("Filtre par date non persistant", "Léa", "À faire", "2 h", "—", "2026-09-05", "Bug remonté par le client : le filtre par date se réinitialise au retour sur la liste."),
    ]},
    { title: "Tunnel d’inscription", lead: "Léa", est: 38, tasks: [
      T("Tunnel d’inscription en 3 étapes", "Léa", "En cours", "10 h", "11 h", "2026-08-29", "Identité, coordonnées, validation. Sauvegarde de l’état entre les étapes et reprise après abandon."),
      T("Validation des champs et messages d’aide", "Léa", "Terminé", "8 h", "9 h", "2026-08-14", "Contrôle en direct des e-mails, mots de passe et codes postaux, avec message explicite sous chaque champ."),
      T("Vérification de l’adresse e-mail", "Karim", "Terminé", "6 h", "7 h", "2026-08-20", "Envoi d’un lien de confirmation valable 24 h, relance automatique après 48 h sans activation."),
    ]},
    { title: "Paiement et facturation", lead: "Marion", est: 62, tasks: [
      T("Intégration paiement Stripe", "Marion", "En cours", "12 h", "9,5 h", "2026-08-28", "Carte bancaire et paiement en trois fois, gestion des échecs et des remboursements partiels."),
      T("Facture PDF vide au-delà de 2 pages", "Marion", "En revue", "3 h", "3,5 h", "2026-08-26", "Bug bloquant : la pagination du moteur PDF était plafonnée à deux pages. Correctif testé sur 40 lignes."),
      T("Page de confirmation de commande", "Léa", "À faire", "6 h", "—", "2026-09-03", "Récapitulatif, numéro de commande, délai de livraison estimé et lien de téléchargement de la facture."),
      T("Webhook paniers abandonnés", "Karim", "À faire", "4 h", "—", "2026-09-05", "Relance par e-mail 4 h puis 24 h après un abandon, avec lien de reprise du panier."),
    ]},
    { title: "Recette et corrections", lead: "Marion", est: 44, tasks: [
      T("Recette client sur préprod", "Marion", "À faire", "20 h", "4 h", "2026-09-11", "Deux semaines de tests côté client sur les huit parcours, avec remontées via le portail."),
      T("Corrections de recette et mise en production", "Marion", "À faire", "24 h", "—", "2026-09-18", "Traitement des remontées de recette, tests de charge et bascule en production."),
    ]},
  ];

  const namedEpics: Record<string, Awaited<ReturnType<typeof prisma.epic.create>>> = {};
  let order = 0;
  for (const e of aivaEpics) {
    const epic = await prisma.epic.create({
      data: { projectId: aiva.id, title: e.title, estHours: e.est, leadId: userByFirst[e.lead].id, order: order++ },
    });
    namedEpics[`Aiva::${e.title}`] = epic;
    let tOrder = 0;
    for (const t of e.tasks) {
      await prisma.task.create({
        data: {
          epicId: epic.id, title: t.title, description: t.desc, status: t.status,
          estHours: t.est, spentHours: t.spent, assigneeId: userByFirst[t.who].id,
          dueAt: t.due === "—" ? null : d(t.due), order: tOrder++,
        },
      });
    }
  }

  // ---------- Epics + tasks: Top Formation ----------
  const tfEpics: { title: string; tasks: { title: string; statusFr: string; changed: string; desc: string }[] }[] = [
    { title: "Comptes et accès", tasks: [
      { title: "Inscription et connexion des apprenants", statusFr: "Terminé", changed: "2026-05-14", desc: "Compte apprenant avec e-mail et mot de passe, mot de passe oublié et vérification de l’adresse." },
      { title: "Espace formateur avec ses sessions", statusFr: "Terminé", changed: "2026-06-02", desc: "Chaque formateur voit ses sessions, ses apprenants inscrits et leurs résultats." },
      { title: "Back-office administrateur", statusFr: "Terminé", changed: "2026-06-18", desc: "Gestion du catalogue, des sessions, des comptes et de la facturation." },
      { title: "Mot de passe oublié et changement d’e-mail", statusFr: "Terminé", changed: "2026-06-24", desc: "Lien de réinitialisation valable 24 h, confirmation sur l’ancienne et la nouvelle adresse." },
    ]},
    { title: "Catalogue et inscription", tasks: [
      { title: "Catalogue des formations avec filtres", statusFr: "Terminé", changed: "2026-07-09", desc: "Filtres par thème, format, durée et date de session, combinables et conservés dans l’URL." },
      { title: "Fiche formation avec programme et dates", statusFr: "Terminé", changed: "2026-07-22", desc: "Programme détaillé, prérequis, tarif et prochaines sessions avec places restantes." },
      { title: "Recherche à la frappe", statusFr: "Terminé", changed: "2026-08-28", desc: "Recherche instantanée avec tolérance aux fautes de frappe sur les titres et les programmes." },
      { title: "Tunnel d’inscription en 3 étapes", statusFr: "En cours", changed: "2026-08-26", desc: "Identité, coordonnées et prise en charge, paiement. Reprise possible après abandon." },
      { title: "Liste d’attente sur session complète", statusFr: "À faire", changed: "—", desc: "Inscription en liste d’attente et notification automatique en cas de désistement." },
    ]},
    { title: "Paiement et documents", tasks: [
      { title: "Paiement par carte bancaire", statusFr: "Terminé", changed: "2026-08-25", desc: "Paiement sécurisé Stripe, reçu immédiat et gestion des échecs de paiement." },
      { title: "Paiement en trois fois", statusFr: "En cours", changed: "2026-08-27", desc: "Disponible au-delà de 600 €, échéances à 30 et 60 jours." },
      { title: "Facture PDF téléchargeable", statusFr: "En revue", changed: "2026-08-26", desc: "Facture disponible dans l’espace apprenant et envoyée par e-mail. Correctif des factures de plus de deux pages en test." },
      { title: "Convention de formation automatique", statusFr: "À faire", changed: "—", desc: "Génération et envoi de la convention sous 24 h après l’inscription." },
    ]},
    { title: "Suivi et exports", tasks: [
      { title: "Attestations de fin de formation", statusFr: "Terminé", changed: "2026-08-27", desc: "Attestation générée à la validation du parcours, téléchargeable par l’apprenant et le formateur." },
      { title: "Tableau de bord formateur", statusFr: "En revue", changed: "2026-08-25", desc: "Progression des apprenants, taux de complétion et résultats par session. Avenant A-398." },
      { title: "Export Excel des résultats", statusFr: "À faire", changed: "—", desc: "Hors périmètre initial. Avenant A-402 en attente de validation : 9 h, 1 200 €." },
    ]},
  ];
  const statusOf = (s: string): TaskStatus => s === "Terminé" ? "TERMINE" : s === "En revue" ? "EN_REVUE" : s === "En cours" ? "EN_COURS" : "A_FAIRE";
  order = 0;
  for (const e of tfEpics) {
    const epic = await prisma.epic.create({
      data: { projectId: topFormation.id, title: e.title, estHours: e.tasks.length * 8, leadId: marion.id, order: order++ },
    });
    namedEpics[`Top Formation::${e.title}`] = epic;
    let tOrder = 0;
    for (const t of e.tasks) {
      await prisma.task.create({
        data: {
          epicId: epic.id, title: t.title, description: t.desc, status: statusOf(t.statusFr),
          estHours: 8, spentHours: statusOf(t.statusFr) === "TERMINE" ? 8 : statusOf(t.statusFr) === "A_FAIRE" ? 0 : 5,
          dueAt: t.changed === "—" ? null : d(t.changed), order: tOrder++,
        },
      });
    }
  }

  // ---------- Lightweight epics used only for ticket grouping ----------
  const lightweightEpics: { title: string; project: typeof aiva }[] = [
    { title: "Inscription", project: topFormation },
    { title: "Lecteur vidéo", project: topFormation },
    { title: "Contenus et modules", project: topFormation },
    { title: "Reporting", project: topFormation },
    { title: "Paiement et facturation", project: ncd },
    { title: "Recherche", project: ncd },
    { title: "Traductions", project: ncd },
    { title: "Espace client", project: aiva },
    { title: "Socle technique", project: aiva },
    { title: "En-tête et navigation", project: tapix },
    { title: "Inscription pro", project: oxy },
    { title: "Contenus", project: oxy },
  ];
  for (const le of lightweightEpics) {
    const epic = await prisma.epic.create({ data: { projectId: le.project.id, title: le.title, estHours: 0 } });
    namedEpics[`${le.project.initials === "AV" && le.project.name === "Refonte plateforme" ? "Aiva" : le.project.initials === "TF" ? "Top Formation" : le.project.initials === "NC" ? "NCD" : le.project.initials === "TX" ? "Tapix" : "Oxy"}::${le.title}`] = epic;
  }

  // ---------- Tickets ----------
  type TicketDef = {
    ref: string; project: typeof aiva; epicTitle: string; projectKey: string;
    type: TicketType; severity?: Severity; devNature?: DevNature;
    title: string; module: string; est: string; statusFr: string; who: "Karim" | "Léa" | "Marion";
  };
  const ticketDefs: TicketDef[] = [
    { ref: "TF-311", project: topFormation, projectKey: "Top Formation", epicTitle: "Inscription", type: "BUG", severity: "BLOQUANT", title: "Le bouton « S’inscrire » ne réagit pas sur Safari", module: "Inscription", est: "2 h", statusFr: "À faire", who: "Léa" },
    { ref: "NCD-208", project: ncd, projectKey: "NCD", epicTitle: "Paiement et facturation", type: "BUG", severity: "BLOQUANT", title: "Facture PDF vide au-delà de 2 pages", module: "Export", est: "3 h", statusFr: "En revue", who: "Marion" },
    { ref: "TF-309", project: topFormation, projectKey: "Top Formation", epicTitle: "Lecteur vidéo", type: "BUG", severity: "MAJEUR", title: "Les vidéos ne reprennent pas la lecture", module: "Lecteur", est: "4 h", statusFr: "En cours", who: "Karim" },
    { ref: "TF-315", project: topFormation, projectKey: "Top Formation", epicTitle: "Reporting", type: "DEV", devNature: "BACK", title: "Export des résultats en Excel", module: "Reporting", est: "9 h", statusFr: "En cours", who: "Léa" },
    { ref: "AIV-238", project: aiva, projectKey: "Aiva", epicTitle: "Catalogue et recherche", type: "BUG", severity: "MAJEUR", title: "Filtre par date non persistant", module: "Recherche", est: "2 h", statusFr: "À faire", who: "Léa" },
    { ref: "TX-142", project: tapix, projectKey: "Tapix", epicTitle: "En-tête et navigation", type: "BUG", severity: "MAJEUR", title: "Logo écrasé sur mobile", module: "En-tête", est: "1 h", statusFr: "En cours", who: "Karim" },
    { ref: "OXY-121", project: oxy, projectKey: "Oxy", epicTitle: "Inscription pro", type: "DEV", devNature: "FRONT", title: "Champ SIRET au formulaire d’inscription", module: "Inscription", est: "2 h", statusFr: "À faire", who: "Marion" },
    { ref: "TF-241", project: topFormation, projectKey: "Top Formation", epicTitle: "Contenus et modules", type: "BUG", severity: "MINEUR", title: "Module 4 : ancien logo affiché", module: "Contenus", est: "0,5 h", statusFr: "À faire", who: "Karim" },
    { ref: "AIV-236", project: aiva, projectKey: "Aiva", epicTitle: "Socle technique", type: "BUG", severity: "MINEUR", title: "Décalage de l’en-tête au défilement", module: "Navigation", est: "1 h", statusFr: "À faire", who: "Léa" },
    { ref: "NCD-212", project: ncd, projectKey: "NCD", epicTitle: "Recherche", type: "DEV", devNature: "API", title: "Ajouter un filtre par fournisseur", module: "Recherche", est: "3 h", statusFr: "En cours", who: "Karim" },
    { ref: "AIV-233", project: aiva, projectKey: "Aiva", epicTitle: "Espace client", type: "DEV", devNature: "FRONT", title: "Tableau de bord utilisateur", module: "Espace client", est: "8 h", statusFr: "En revue", who: "Léa" },
    { ref: "NCD-205", project: ncd, projectKey: "NCD", epicTitle: "Traductions", type: "BUG", severity: "MINEUR", title: "Message d’erreur non traduit", module: "i18n", est: "0,5 h", statusFr: "En revue", who: "Karim" },
    { ref: "OXY-118", project: oxy, projectKey: "Oxy", epicTitle: "Contenus", type: "BUG", severity: "MINEUR", title: "Fautes de frappe page tarifs", module: "Contenus", est: "0,5 h", statusFr: "Terminé", who: "Marion" },
  ];

  const detailed: Record<string, { desc: string; steps: string[]; files: { name: string; meta: string }[]; comments: { who: "Karim" | "Léa" | "Marion"; text: string }[]; spent: number }> = {
    "TF-311": {
      desc: "Sur Safari (macOS 15), le bouton « S’inscrire » du bas de la page d’accueil ne déclenche rien. Aucune erreur visible pour l’utilisateur. Sur Chrome et Firefox le tunnel s’ouvre normalement. Trois formateurs du client sont bloqués.",
      steps: ["Ouvrir la page d’accueil sur Safari 18 (macOS).", "Descendre jusqu’au bloc « Rejoindre une formation ».", "Cliquer sur « S’inscrire » — rien ne se passe, la console remonte une erreur de handler non attaché."],
      files: [{ name: "capture-safari.png", meta: "412 ko · déposé par Sophie Renard" }, { name: "ecran-safari.mov", meta: "2,1 Mo · 14 s" }, { name: "console-safari.log", meta: "8 ko" }],
      comments: [
        { who: "Marion", text: "Signalement client reçu ce matin : trois formateurs bloqués. Reproduit sur Safari 18, qualifié bloquant. Léa, tu peux prendre en priorité ?" },
        { who: "Léa", text: "Vu. C’est le listener attaché avant l’hydratation, Safari est plus strict. Je corrige et je passe en revue aujourd’hui." },
      ], spent: 0,
    },
    "NCD-208": {
      desc: "Le PDF généré est vide dès que le devis dépasse deux pages, soit environ vingt lignes. Le client doit renvoyer les devis à la main. Cause identifiée : la pagination du moteur PDF était limitée à deux pages.",
      steps: ["Créer un devis de plus de vingt lignes dans le back-office.", "Cliquer sur « Générer le PDF ».", "Le fichier téléchargé fait 0 ko."],
      files: [{ name: "devis-vide.pdf", meta: "0 ko · déposé par Marc Le Gall" }, { name: "devis-corrige.pdf", meta: "184 ko · après correctif" }],
      comments: [
        { who: "Marion", text: "Reproduit. Je prends celui-là, je connais le moteur PDF." },
        { who: "Marion", text: "Corrigé, la pagination est maintenant illimitée. Testé sur un devis de 40 lignes en préprod. Passé en revue." },
      ], spent: 3.5,
    },
    "TF-315": {
      desc: "Le client veut exporter les résultats d’un groupe en Excel, avec le détail par module et par apprenant. Hors périmètre du cahier des charges initial, chiffré 9 h et validé par avenant D-441.",
      steps: ["Ajouter un bouton « Exporter » sur la vue Résultats du groupe.", "Générer un XLSX avec une feuille par module.", "Inclure le taux de complétion et la note par apprenant."],
      files: [{ name: "modele-attendu.xlsx", meta: "46 ko · fourni par le client" }],
      comments: [
        { who: "Marion", text: "Devis signé, on peut lancer. Léa, tu as le modèle de fichier attendu en pièce jointe." },
        { who: "Léa", text: "La génération est en place, il me reste la feuille par module." },
      ], spent: 5,
    },
  };
  const reviewSpent: Record<string, number> = { "NCD-208": 3.5, "AIV-233": 7, "NCD-205": 0.5 };

  const ticketsByRef: Record<string, Awaited<ReturnType<typeof prisma.ticket.create>>> = {};

  for (const t of ticketDefs) {
    const epic = namedEpics[`${t.projectKey}::${t.epicTitle}`];
    const info = detailed[t.ref];
    const spent = reviewSpent[t.ref] ?? (t.statusFr === "Terminé" ? hoursFr(t.est) : 0);
    const ticket = await prisma.ticket.create({
      data: {
        ref: t.ref, projectId: t.project.id, epicId: epic?.id, type: t.type,
        severity: t.severity, devNature: t.devNature, status: statusOf(t.statusFr),
        title: t.title, module: t.module, estHours: hoursFr(t.est), spentHours: spent,
        description: info?.desc ?? `Comportement signalé par le client puis reproduit en préprod (module ${t.module}). Le correctif touche un seul module, pas de régression attendue ailleurs.`,
        steps: (info?.steps ?? ["Ouvrir la page concernée en préprod avec le compte de test client.", "Reproduire l’action décrite par le client.", "Constater l’écart avec le comportement attendu."]).join("\n"),
        assigneeId: userByFirst[t.who].id,
        creatorId: marion.id,
      },
    });
    const files = info?.files ?? [{ name: "capture-client.png", meta: "340 ko · déposé par le client" }];
    for (const f of files) {
      await prisma.ticketAttachment.create({ data: { ticketId: ticket.id, filename: f.name, meta: f.meta } });
    }
    const comments = info?.comments ?? [
      { who: "Marion" as const, text: "Reproduit de mon côté. Je qualifie et je passe au dev." },
      { who: "Léa" as const, text: "Je prends, ça touche le même composant qu’un ticket précédent." },
    ];
    for (const c of comments) {
      await prisma.ticketComment.create({ data: { ticketId: ticket.id, authorId: userByFirst[c.who].id, body: c.text } });
    }
    ticketsByRef[t.ref] = ticket;
  }

  // ---------- Client-portal users ----------
  const sophie = await prisma.user.create({
    data: { email: "sophie@topformation.fr", passwordHash, name: "Sophie Renard", initials: "SR", role: "CLIENT", clientId: clients["Top Formation"].id },
  });
  await prisma.projectAssignment.create({ data: { projectId: topFormation.id, userId: sophie.id } });
  const marc = await prisma.user.create({
    data: { email: "marc@ncd.fr", passwordHash, name: "Marc Le Gall", initials: "MG", role: "CLIENT", clientId: clients["NCD"].id },
  });
  await prisma.projectAssignment.create({ data: { projectId: ncd.id, userId: marc.id } });
  const nadia = await prisma.user.create({
    data: { email: "nadia@tapix.fr", passwordHash, name: "Nadia Ferrand", initials: "NF", role: "CLIENT", clientId: clients["Tapix"].id },
  });
  await prisma.projectAssignment.create({ data: { projectId: tapix.id, userId: nadia.id } });

  // ---------- Project financials (Rentabilité) ----------
  const profitData: Record<string, { sold: number; cost: number }> = {
    Aiva: { sold: 36000, cost: 23700 },
    "Top Formation": { sold: 28500, cost: 20500 },
    Tapix: { sold: 18000, cost: 16400 },
    NCD: { sold: 24000, cost: 14200 },
    "Mois du Ker": { sold: 9800, cost: 7600 },
    Oxy: { sold: 12000, cost: 13100 },
  };
  const activeByKey: Record<string, typeof aiva> = { Aiva: aiva, "Top Formation": topFormation, Tapix: tapix, NCD: ncd, "Mois du Ker": moisDuKer, Oxy: oxy };
  for (const [key, proj] of Object.entries(activeByKey)) {
    const p = profitData[key];
    await prisma.project.update({ where: { id: proj.id }, data: { soldAmount: p.sold, costAmount: p.cost } });
  }

  // ---------- Remontées client (Triage) ----------
  type TriageThreadMsg = { who: string; text: string; mine: boolean };
  type TriageDef = {
    ref: string; project: typeof aiva; who: string; title: string; state: keyof typeof TRIAGE_STATE_MAP;
    type: "BUG" | "DEV"; severity?: "BLOQUANT" | "MAJEUR" | "MINEUR"; est: string; module: string;
    assignee: "Léa" | "Karim" | "Marion" | null; hasShot: boolean; shot: string; body?: string; thread: TriageThreadMsg[];
  };
  const TRIAGE_STATE_MAP = {
    "À qualifier": "A_QUALIFIER", "À chiffrer": "A_CHIFFRER", Transmis: "TRANSMIS", "Devis envoyé": "DEVIS_ENVOYE", Clos: "CLOS",
  } as const;
  const triageDefs: TriageDef[] = [
    { ref: "R-118", project: topFormation, who: "Sophie Renard", title: "Le bouton « S’inscrire » ne réagit pas sur Safari", state: "À qualifier", type: "BUG", severity: "BLOQUANT", est: "2 h", module: "Inscription", assignee: "Léa", hasShot: true, shot: "capture-safari.png",
      body: "Sur Safari (Mac), rien ne se passe quand je clique sur le bouton d’inscription en bas de la page d’accueil. Sur Chrome cela fonctionne. Trois de nos formateurs ont le même souci.", thread: [] },
    { ref: "R-117", project: ncd, who: "Marc Le Gall", title: "Facture PDF vide quand le devis dépasse 2 pages", state: "À qualifier", type: "BUG", severity: "BLOQUANT", est: "3 h", module: "Export", assignee: "Marion", hasShot: true, shot: "capture-pdf.png",
      body: "Le PDF généré est vide dès que le devis contient plus de vingt lignes. Nous devons les renvoyer à la main.",
      thread: [{ who: "Marion — cheffe de projet", text: "Bien reçu, je reproduis de mon côté et je reviens vers vous aujourd’hui.", mine: true }] },
    { ref: "R-116", project: topFormation, who: "Sophie Renard", title: "Ajouter un export des résultats en Excel", state: "À chiffrer", type: "DEV", est: "9 h", module: "Reporting", assignee: null, hasShot: false, shot: "",
      body: "Nos formateurs voudraient exporter les résultats d’un groupe en Excel, avec le détail par module.",
      thread: [{ who: "Marion — cheffe de projet", text: "C’est une évolution hors périmètre. Je vous chiffre ça aujourd’hui, comptez une journée de développement.", mine: true }] },
    { ref: "R-115", project: topFormation, who: "Sophie Renard", title: "Module 4 : ancien logo affiché", state: "Transmis", type: "BUG", severity: "MINEUR", est: "0,5 h", module: "Contenus", assignee: "Karim", hasShot: true, shot: "capture-module4.png",
      body: "L’en-tête du module 4 montre encore la version précédente du logo.",
      thread: [
        { who: "Marion — cheffe de projet", text: "C’est un oubli de notre côté, corrigé avant vendredi.", mine: true },
        { who: "Interne", text: "Transmis à Karim · mineur · est. 0,5 h · tâche TF-241.", mine: false },
      ] },
    { ref: "R-112", project: tapix, who: "Nadia Ferrand", title: "Logo écrasé sur la page d’accueil mobile", state: "À qualifier", type: "BUG", severity: "MAJEUR", est: "1 h", module: "En-tête", assignee: "Karim", hasShot: true, shot: "capture-mobile.png", thread: [] },
    { ref: "R-104", project: topFormation, who: "Sophie Renard", title: "Fautes de frappe sur la page tarifs", state: "Clos", type: "BUG", severity: "MINEUR", est: "0,5 h", module: "Contenus", assignee: "Marion", hasShot: true, shot: "capture-tarifs.png",
      body: "Deux coquilles dans le deuxième paragraphe et le prix mensuel affiché sans TVA.",
      thread: [{ who: "Marion — cheffe de projet", text: "Corrigé et en ligne. Je clos le ticket.", mine: true }] },
    { ref: "R-101", project: ncd, who: "Marc Le Gall", title: "Impossible de télécharger l’export mensuel", state: "Clos", type: "BUG", severity: "MAJEUR", est: "1,5 h", module: "Export", assignee: "Léa", hasShot: false, shot: "",
      body: "Le lien de téléchargement renvoyait une erreur 404 en fin de mois.",
      thread: [{ who: "Marion — cheffe de projet", text: "Corrigé par Léa, validé de votre côté. Ticket clos.", mine: true }] },
    { ref: "R-109", project: oxy, who: "Paul Adam", title: "Ajouter un champ SIRET au formulaire", state: "Devis envoyé", type: "DEV", est: "2 h", module: "Inscription", assignee: null, hasShot: false, shot: "",
      body: "Nous aimerions collecter le SIRET à l’inscription des professionnels.",
      thread: [{ who: "Marion — cheffe de projet", text: "Ce n’est pas un bug mais une évolution : je vous envoie un devis complémentaire de 2 h.", mine: true }] },
  ];
  for (const tr of triageDefs) {
    const t = await prisma.ticket.create({
      data: {
        ref: tr.ref, projectId: tr.project.id, type: tr.type, severity: tr.severity, module: tr.module,
        status: tr.state === "Clos" ? "TERMINE" : "A_FAIRE",
        title: tr.title, description: tr.body ?? "", estHours: hoursFr(tr.est),
        assigneeId: tr.assignee ? userByFirst[tr.assignee].id : null,
        creatorId: null, clientReported: true, triageState: TRIAGE_STATE_MAP[tr.state],
      },
    });
    if (tr.hasShot) {
      await prisma.ticketAttachment.create({ data: { ticketId: t.id, filename: tr.shot, meta: `déposé par ${tr.who}` } });
    }
    for (const m of tr.thread) {
      await prisma.triageReply.create({ data: { ticketId: t.id, authorLabel: m.who, body: m.text, mine: m.mine } });
    }
  }

  // ---------- Messagerie ----------
  const who = { cv: claire, jm: marion, lm: lea, kb: karim } as const;
  type ThreadMsgDef = { key?: keyof typeof who; day?: string; time?: string; text?: string; ref?: string };
  type ThreadDef = { id: string; kind: "PROJECT" | "DIRECT" | "INTERNAL"; project?: typeof aiva; title: string; people: (keyof typeof who)[]; messages: ThreadMsgDef[] };

  const threadDefs: ThreadDef[] = [
    { id: "aiva", kind: "PROJECT", project: aiva, title: "Aiva — Refonte plateforme", people: ["jm", "lm", "kb", "cv"], messages: [
      { key: "jm", text: "Point sprint 4 : il nous reste le paiement et la page de confirmation. On tient le 18 septembre si rien ne dérape." },
      { key: "kb", text: "De mon côté les états vides avancent, j’ai deux heures de retard sur l’estimation mais rien de bloquant." },
      { key: "kb", text: "Il faudrait prévoir une page 404 sur mesure, on n’a que celle du serveur pour l’instant." },
      { key: "cv", text: "Attention au budget : 214 h sur 300 vendues et il reste deux gros chantiers. Marion, tu confirmes qu’on rentre dedans ?" },
      { key: "jm", text: "Oui, 86 h restantes pour 80 h estimées. C’est juste mais ça passe si on ne prend pas de demande hors périmètre." },
      { key: "lm", text: "Le paiement carte passe en test. Reste le trois fois et les remboursements partiels." },
      { key: "jm", text: "Bien noté. Pense à la clé d’idempotence sur les webhooks, Stripe rejoue les événements." },
      { key: "lm", text: "C’est en place. Je passe le tableau de bord en revue, tu peux valider quand tu veux.", ref: "AIV-233" },
    ]},
    { id: "tf", kind: "PROJECT", project: topFormation, title: "Top Formation — e-learning", people: ["jm", "lm", "kb"], messages: [
      { key: "jm", text: "Sophie a signalé que le bouton d’inscription ne réagit pas sur Safari. Trois formateurs bloqués, je qualifie bloquant.", ref: "TF-311" },
      { key: "lm", text: "Je prends. C’est le listener attaché avant l’hydratation, Safari est plus strict là-dessus." },
      { key: "jm", text: "Merci. Elle demande aussi un export Excel des résultats : c’est hors périmètre, je pars sur un avenant de 9 h." },
      { key: "kb", text: "Si l’avenant passe, je peux le prendre au sprint 5, j’aurai fini les contenus." },
    ]},
    { id: "ncd", kind: "PROJECT", project: ncd, title: "NCD — Portail fournisseurs", people: ["jm", "lm", "cv"], messages: [
      { key: "lm", text: "Recette côté client terminée sur le dépôt de devis, il reste l’export mensuel à repasser." },
      { key: "jm", text: "Le PDF vide est corrigé, testé sur 40 lignes. Je le passe en revue.", ref: "NCD-208" },
      { key: "cv", text: "Bien. Autre sujet : la facture de juin est toujours impayée, 15 jours de retard. J’appelle Marc demain, ne relancez pas de votre côté." },
    ]},
    { id: "oxy", kind: "PROJECT", project: oxy, title: "Oxy — Refonte identité & site", people: ["jm", "kb", "cv"], messages: [
      { key: "jm", text: "Le cadrage a débordé : 31 h consommées sur 25 vendues. Le client continue d’ajouter des demandes." },
      { key: "cv", text: "On arrête là. Soit il signe un avenant, soit on livre le périmètre initial. Je tranche cette semaine." },
      { key: "kb", text: "Pour info le champ SIRET demandé est chiffré à 2 h, devis D-441 envoyé." },
    ]},
    { id: "interne", kind: "INTERNAL", title: "Interne — Agence", people: ["cv", "jm", "lm", "kb"], messages: [
      { key: "cv", text: "Deux affaires devraient démarrer en octobre, Groupe Lantier et Selva. On serait à 92 % de capacité. On décale un démarrage ou on prend un freelance ?" },
      { key: "jm", text: "Lantier peut commencer mi-octobre sans souci pour eux. Ça nous laisse de l’air." },
      { key: "lm", text: "Un renfort front sur deux semaines m’irait bien si Lantier reste en octobre." },
      { key: "cv", text: "Je regarde les deux options et je tranche avant le 5 septembre." },
    ]},
  ];
  const directDefs: ThreadDef[] = [
    { id: "dm-jm-lm", kind: "DIRECT", title: "Marion Lefèvre", people: ["jm", "lm"], messages: [
      { key: "lm", text: "J’ai fini le tunnel d’inscription, une heure de plus que prévu à cause de la reprise après fermeture du navigateur." },
      { key: "jm", text: "Pas de souci, c’est absorbé par l’épic. Bon boulot." },
      { key: "jm", text: "Sophie vient de signaler un bug bloquant sur Safari, tu peux le prendre en priorité ? Je décale le filtre par date.", ref: "TF-311" },
      { key: "lm", text: "Oui je m’en occupe ce matin." },
      { key: "lm", text: "Autre chose : il faudrait un écran de relance des paniers abandonnés sur Aiva, sinon on perd les commandes en cours. Tu peux me créer le ticket ?" },
      { key: "jm", text: "Bonne idée, je te le crée depuis ce message." },
    ]},
    { id: "dm-cv-jm", kind: "DIRECT", title: "Claire Vasseur", people: ["cv", "jm"], messages: [
      { key: "cv", text: "Marion, Oxy est à −9 % de marge et le client continue d’ajouter des demandes. On arbitre avant vendredi." },
      { key: "cv", text: "Il nous faudrait aussi un export du temps passé par projet en CSV, pour la compta. Peux-tu le faire chiffrer ?" },
      { key: "jm", text: "D’accord. Je prépare deux options : avenant de 12 h, ou livraison du périmètre initial et le reste en phase 2." },
      { key: "cv", text: "Parfait. Prépare aussi le chiffrage phase 2, ça nous fait un devis à envoyer dans la foulée." },
    ]},
    { id: "dm-lm-kb", kind: "DIRECT", title: "Karim Belkacem", people: ["lm", "kb"], messages: [
      { key: "lm", text: "Tu avances sur les états vides ? J’en ai besoin pour le tableau de bord." },
      { key: "kb", text: "Deux sur trois sont faits. Je te pousse la branche ce soir, tu pourras brancher le tien dessus." },
      { key: "lm", text: "Nickel, merci." },
    ]},
    { id: "dm-cv-lm", kind: "DIRECT", title: "Claire Vasseur", people: ["cv", "lm"], messages: [
      { key: "cv", text: "Léa, il faut qu’on cale ton entretien trimestriel avant fin septembre. Ton taux facturable est à 88 %, au-dessus de l’objectif." },
      { key: "lm", text: "Volontiers. Je suis dispo la semaine du 8, sauf le mardi." },
    ]},
  ];

  let msgClock = d("2026-08-27").getTime();
  for (const td of [...threadDefs, ...directDefs]) {
    const thread = await prisma.messageThread.create({
      data: { kind: td.kind, projectId: td.project?.id ?? null, title: td.title },
    });
    for (const p of td.people) {
      await prisma.threadParticipant.create({ data: { threadId: thread.id, userId: who[p].id } });
    }
    for (const m of td.messages) {
      if (!m.key || !m.text) continue;
      msgClock += 20 * 60 * 1000;
      const cited = m.ref ? ticketsByRef[m.ref] : undefined;
      await prisma.message.create({
        data: {
          threadId: thread.id, authorId: who[m.key].id, body: m.text,
          citedTicketRef: cited?.ref, citedLabel: cited ? `${cited.ref} · ${cited.title}` : null,
          createdAt: new Date(msgClock),
        },
      });
    }
  }

  // ---------- Ressources (Aiva showcases APIs/URLs/comptes/maquettes; CDC lives on Aiva + Top Formation) ----------
  const apiDefs = [
    { name: "Stripe", role: "Paiements et abonnements", env: "Test", base: "https://api.stripe.com/v1", key: "sk_test_••••••4f2a", auth: "Bearer", owner: marion, expiry: "sans expiration" },
    { name: "Stripe", role: "Paiements et abonnements", env: "Production", base: "https://api.stripe.com/v1", key: "sk_live_••••••9b71", auth: "Bearer", owner: marion, expiry: "accès restreint" },
    { name: "Brevo", role: "E-mails transactionnels", env: "Test", base: "https://api.brevo.com/v3", key: "xkeysib-••••••c103", auth: "api-key header", owner: lea, expiry: "expire 12 déc. 2026" },
    { name: "Algolia", role: "Recherche du catalogue", env: "Préprod", base: "https://aiva-2.algolia.net/1", key: "search-••••••7e44", auth: "App ID + clé", owner: karim, expiry: "sans expiration" },
    { name: "Auth0", role: "Authentification et rôles", env: "Préprod", base: "https://aiva-preprod.eu.auth0.com", key: "cid_••••••2d90", auth: "OAuth 2 / PKCE", owner: karim, expiry: "rotation 90 j" },
    { name: "API interne Aiva", role: "Back-office et catalogue", env: "Préprod", base: "https://api-preprod.aiva.fr/v2", key: "tok_••••••a518", auth: "JWT interne", owner: marion, expiry: "renouvelé au déploiement" },
  ];
  for (const [i, a] of apiDefs.entries()) {
    await prisma.apiCredential.create({
      data: { projectId: aiva.id, name: a.name, role: a.role, env: a.env, baseUrl: a.base, maskedKey: a.key, authType: a.auth, ownerId: a.owner.id, expiryNote: a.expiry, order: i },
    });
  }

  const urlDefs = [
    { env: "Production", url: "https://app.aiva.fr", access: "Public", deploy: "12 août · v1.8.2" },
    { env: "Préprod", url: "https://preprod.aiva.fr", access: "Mot de passe", deploy: "aujourd’hui · v1.9.0-rc3" },
    { env: "Recette client", url: "https://recette.aiva.fr", access: "Lien + code", deploy: "hier · v1.9.0-rc2" },
    { env: "Back-office", url: "https://admin-preprod.aiva.fr", access: "VPN + 2FA", deploy: "aujourd’hui" },
    { env: "Documentation API", url: "https://api-preprod.aiva.fr/docs", access: "Interne", deploy: "auto" },
    { env: "Maquettes Claude Design", url: "https://claude.design/aiva-refonte", access: "Lien équipe", deploy: "20 août" },
  ];
  for (const [i, u] of urlDefs.entries()) {
    await prisma.projectUrl.create({ data: { projectId: aiva.id, env: u.env, url: u.url, access: u.access, deployNote: u.deploy, order: i } });
  }

  const accountDefs = [
    { role: "ADMIN", login: "admin@test.aiva.fr", pass: "Aiva!Test2026", env: "Préprod", note: "tous les droits" },
    { role: "CLIENT", login: "client1@test.aiva.fr", pass: "Client!2026", env: "Préprod", note: "panier rempli" },
    { role: "CLIENT", login: "client2@test.aiva.fr", pass: "Client!2026", env: "Préprod", note: "aucune commande" },
    { role: "VENDEUR", login: "vendeur@test.aiva.fr", pass: "Vend!2026", env: "Préprod", note: "12 produits" },
    { role: "SUPPORT", login: "support@test.aiva.fr", pass: "Supp!2026", env: "Préprod", note: "lecture seule" },
    { role: "CLIENT", login: "recette@aiva.fr", pass: "Recette2026", env: "Recette", note: "compte du client" },
  ];
  for (const [i, a] of accountDefs.entries()) {
    await prisma.testAccount.create({ data: { projectId: aiva.id, role: a.role, login: a.login, passwordMasked: a.pass, env: a.env, note: a.note, order: i } });
  }

  const mockupDefs: { name: string; version: string; status: "VALIDE" | "EN_INTEGRATION" | "A_VALIDER" | "BROUILLON" }[] = [
    { name: "Tunnel de paiement", version: "v2 · en attente retour client", status: "A_VALIDER" },
    { name: "Tableau de bord utilisateur", version: "v2 · validé le 14 août", status: "VALIDE" },
    { name: "États vides et erreurs", version: "v1 · en cours de design", status: "BROUILLON" },
    { name: "Back-office — commandes", version: "v1 · à cadrer", status: "BROUILLON" },
  ];
  for (const m of mockupDefs) {
    await prisma.mockup.create({ data: { projectId: aiva.id, name: m.name, version: m.version, status: m.status } });
  }
  await prisma.mockupSource.create({ data: { projectId: aiva.id, label: "Maquettes Aiva — Claude Design", url: "https://claude.design/aiva-refonte", status: "À jour" } });
  await prisma.mockupSource.create({ data: { projectId: aiva.id, label: "Design system Codialis", url: "https://claude.design/codialis-design-system", status: "À jour" } });

  await prisma.cdcDocument.create({
    data: { projectId: aiva.id, name: "Cahier des charges v3", version: "v3", meta: "42 pages · validé le 8 juin · signé", status: "En vigueur", order: 0 },
  });
  await prisma.cdcDocument.create({
    data: { projectId: aiva.id, name: "Spécifications fonctionnelles — paiement", version: "v1", meta: "11 pages · mis à jour le 14 août", status: "En vigueur", order: 1 },
  });
  await prisma.cdcDocument.create({
    data: { projectId: aiva.id, name: "Cahier des charges v2", version: "v2", meta: "38 pages · remplacé le 8 juin", status: "Archivé", order: 2 },
  });
  const techDocDefs = [
    { name: "Modèle de données", ext: "PDF", meta: "6 pages · mis à jour le 2 juillet", status: "À jour" },
    { name: "Schéma d’architecture", ext: "PNG", meta: "mis à jour le 18 août", status: "À jour" },
    { name: "Maquettes validées — export", ext: "PDF", meta: "8 écrans · Claude Design · 8 juil.", status: "À jour" },
    { name: "Convention de code et branches", ext: "MD", meta: "dans le dépôt · README-dev", status: "À jour" },
    { name: "Procédure de déploiement", ext: "MD", meta: "mise à jour le 12 août", status: "À relire" },
  ];
  for (const [i, td2] of techDocDefs.entries()) {
    await prisma.techDoc.create({ data: { projectId: aiva.id, name: td2.name, ext: td2.ext, meta: td2.meta, status: td2.status, order: i } });
  }

  await prisma.customCategory.create({
    data: {
      projectId: aiva.id, name: "RGPD & conformité", visibility: "TEAM", format: "TABLE",
      columns: JSON.stringify(["Élément", "Détail", "Responsable", "Statut"]), authorId: marion.id,
      rows: { create: [
        { data: JSON.stringify(["Sous-traitants déclarés", "Stripe, Brevo, Algolia, OVH", "Marion L.", "À jour"]), order: 0 },
        { data: JSON.stringify(["Registre des traitements", "Comptes clients et commandes", "Marion L.", "À jour"]), order: 1 },
      ]},
    },
  });
  await prisma.customCategory.create({
    data: {
      projectId: aiva.id, name: "Reprise de données", visibility: "TEAM", format: "NOTES",
      columns: JSON.stringify(["Note"]), authorId: karim.id,
      rows: { create: [{ data: JSON.stringify(["Migration des 4 200 comptes clients depuis l’ancien back-office, script de vérification exécuté le 28 juillet."]), order: 0 }] },
    },
  });
  await prisma.customCategory.create({
    data: {
      projectId: aiva.id, name: "Performance & SEO", visibility: "PM_ONLY", format: "TABLE",
      columns: JSON.stringify(["Page", "Score", "Action"]), authorId: marion.id,
      rows: { create: [
        { data: JSON.stringify(["Accueil", "92", "aucune"]), order: 0 },
        { data: JSON.stringify(["Catalogue", "78", "images à compresser"]), order: 1 },
      ]},
    },
  });

  // ---------- Rentabilité: invoices ----------
  const invoiceDefs: { ref: string; project: typeof aiva; label: string; amount: number; issued: string; due?: string; paid?: string; status: "EN_ATTENTE" | "EN_RETARD" | "PAYEE" }[] = [
    { ref: "F-2608", project: aiva, label: "Aiva — jalon 3", amount: 12000, issued: "2026-08-20", status: "EN_ATTENTE" },
    { ref: "F-2604", project: ncd, label: "NCD — jalon 2", amount: 6000, issued: "2026-07-10", due: "2026-08-10", status: "EN_RETARD" },
    { ref: "F-2601", project: tapix, label: "Tapix — acompte", amount: 2400, issued: "2026-07-05", due: "2026-08-05", status: "EN_RETARD" },
    { ref: "F-2597", project: topFormation, label: "Top Formation — jalon 2", amount: 9500, issued: "2026-07-12", due: "2026-08-20", paid: "2026-08-12", status: "PAYEE" },
  ];
  for (const inv of invoiceDefs) {
    await prisma.invoice.create({
      data: {
        ref: inv.ref, projectId: inv.project.id, label: inv.label, amount: inv.amount,
        issuedAt: d(inv.issued), dueAt: inv.due ? d(inv.due) : null, paidAt: inv.paid ? d(inv.paid) : null, status: inv.status,
      },
    });
  }

  // ---------- Maintenance contracts ----------
  await prisma.maintenanceContract.create({
    data: { projectId: projects["Chalvin & Fils"][0].id, monthlyPrice: 450, includedHours: 4, usedHoursThisMonth: 3, renewalNote: "renouvellement 1 mars 2027" },
  });
  await prisma.maintenanceContract.create({
    data: { projectId: projects["NCD"][2].id, monthlyPrice: 550, includedHours: 5, usedHoursThisMonth: 7, renewalNote: "à renouveler 31 décembre" },
  });
  await prisma.maintenanceContract.create({
    data: { projectId: projects["Mois du Ker"][2].id, monthlyPrice: 250, includedHours: 2, usedHoursThisMonth: 1, renewalNote: "fin octobre 2026" },
  });

  // ---------- Automatisations ----------
  const ruleDefs: { title: string; trigger: string; mode: "AUTO" | "TO_VALIDATE"; channel: string; lastRun: string; stat: string }[] = [
    { title: "Facture en retard", trigger: "Relance J+3, J+10 puis J+21 après l’échéance. Ton progressif, courtois puis ferme.", mode: "AUTO", channel: "e-mail comptabilité", lastRun: "NCD, hier", stat: "9 envoyées · 6 payées" },
    { title: "Signalement sans réponse", trigger: "Si un ticket client reste sans réponse plus de 4 h ouvrées, notification à la cheffe de projet et brouillon de réponse préparé.", mode: "AUTO", channel: "notification interne", lastRun: "Top Formation, ce matin", stat: "4 ce mois" },
    { title: "Attente d’un retour client", trigger: "Relance le client quand une validation attend depuis 5 jours et bloque une tâche.", mode: "TO_VALIDATE", channel: "portail + e-mail", lastRun: "Tapix, il y a 2 j", stat: "7 ce mois" },
    { title: "Point hebdomadaire client", trigger: "Chaque vendredi, résumé rédigé depuis les tâches terminées, les heures et les jalons à venir.", mode: "TO_VALIDATE", channel: "portail client", lastRun: "vendredi 22 août", stat: "5 projets couverts" },
    { title: "Alerte budget et dépassement", trigger: "Dès que les heures consommées atteignent 80 % du vendu, alerte interne avec la projection de fin de projet.", mode: "AUTO", channel: "notification interne", lastRun: "Oxy, il y a 4 j", stat: "3 alertes actives" },
    { title: "Fin de garantie", trigger: "J-15 avant la fin de garantie, proposition de contrat de maintenance envoyée au client.", mode: "TO_VALIDATE", channel: "e-mail commercial", lastRun: "Selva, il y a 6 j", stat: "2 contrats signés" },
  ];
  for (const [i, r] of ruleDefs.entries()) {
    await prisma.automationRule.create({ data: { title: r.title, trigger: r.trigger, mode: r.mode, channel: r.channel, lastRun: r.lastRun, stat: r.stat, order: i } });
  }

  const draftDefs = [
    { to: "NCD — Marc Le Gall", kind: "Relance facture J+10", text: "Bonjour Marc, la facture F-2604 de 6 000 € était due le 10 août. Pouvez-vous me dire où elle en est dans votre circuit de validation ? Je reste disponible si un justificatif manque." },
    { to: "Tapix — Nadia Ferrand", kind: "Attente de validation", text: "Bonjour Nadia, les maquettes de l’écran profil attendent votre retour depuis le 20 août. Sans validation avant jeudi, la livraison du 5 septembre glissera d’une semaine." },
    { to: "Top Formation — Sophie Renard", kind: "Point hebdomadaire", text: "Bonjour Sophie, cette semaine : deux modules intégrés, le bug du logo corrigé, 8 h 30 passées. Avancement 62 %. Prochaine étape le 4 septembre, la recette commence." },
  ];
  for (const dr of draftDefs) {
    await prisma.automationDraft.create({ data: { toWho: dr.to, kind: dr.kind, text: dr.text, status: "PENDING" } });
  }

  const signalDefs = [
    { text: "Oxy dépasse le budget vendu de 6 h avant la moitié du projet.", meta: "marge projetée −9 % · détecté il y a 4 j", severity: "red" },
    { text: "Trois signalements sur le module Inscription en dix jours.", meta: "Top Formation · possible cause commune", severity: "amber" },
    { text: "La garantie Selva se termine dans 8 jours.", meta: "proposition de contrat prête", severity: "amber" },
    { text: "NCD paie en moyenne 18 jours après l’échéance.", meta: "sur les 6 dernières factures", severity: "blue" },
  ];
  for (const [i, s] of signalDefs.entries()) {
    await prisma.automationSignal.create({ data: { text: s.text, meta: s.meta, severity: s.severity, order: i } });
  }

  await prisma.absenceSetting.create({
    data: {
      pmId: marion.id, mode: "OUVERT", enabled: false, rangeLabel: "du 28 août au 1er septembre",
      substituteId: karim.id, nextAbsence: "23 au 27 octobre (Léa Mercier)",
    },
  });

  // Business parameters (quarterly sales target, fixed monthly charges) — editable
  // from the CRM/Pilotage screens rather than hardcoded, so this is just their
  // starting values.
  await prisma.companySetting.create({ data: {} });

  await prisma.internalTask.create({
    data: {
      title: "Formation Next.js 16 (App Router)",
      description: "Se former sur les nouveautés du framework avant le prochain projet.",
      assigneeId: marion.id, assignerId: claire.id,
      dueAt: d("2026-09-15"),
    },
  });

  // ---------- Client questions (fiche projet) ----------
  const clientQuestionDefs: { project: typeof aiva; question: string; status: "A_DEMANDER" | "DEMANDE" | "REPONDU"; answer?: string; askedAt?: string; answeredAt?: string }[] = [
    { project: aiva, question: "Date limite souhaitée pour la mise en production ?", status: "DEMANDE", askedAt: "2026-08-20" },
    { project: aiva, question: "Le paiement Stripe doit-il gérer les remboursements partiels ?", status: "REPONDU", answer: "Oui, jusqu’à 3 remboursements partiels par commande.", askedAt: "2026-08-10", answeredAt: "2026-08-14" },
    { project: topFormation, question: "Qui doit avoir accès à l’export Excel des résultats (tous les formateurs ou juste les admins) ?", status: "A_DEMANDER" },
  ];
  for (const q of clientQuestionDefs) {
    await prisma.clientQuestion.create({
      data: {
        projectId: q.project.id, question: q.question, status: q.status,
        answer: q.answer ?? "", askedAt: q.askedAt ? d(q.askedAt) : null, answeredAt: q.answeredAt ? d(q.answeredAt) : null,
      },
    });
  }

  // ---------- RH (heures, absences, planning, déplacements) ----------
  // Les soldes sont « à ancre » : la valeur est le solde réel au jour de l'ancre,
  // et le calcul repart de là (voir src/lib/balances.ts). Sans ancre, aucun
  // congé payé ne peut être posé.
  const leaveAnchor = new Date("2026-07-01");
  for (const u of [lea, karim, marion]) {
    await prisma.user.update({
      where: { id: u.id },
      data: { leaveBalance: 12, leaveAnchor, hoursBalance: 4, hoursAnchor: leaveAnchor },
    });
  }

  await prisma.hoursEntry.create({ data: { userId: lea.id, kind: "SUP", date: d("2026-09-02"), hours: 2, reason: "Recette client en soirée sur Aiva", status: "DECLARE" } });
  await prisma.hoursEntry.create({ data: { userId: karim.id, kind: "SUP", date: d("2026-09-03"), hours: 1.5, reason: "Correctif urgent Oxy", status: "VALIDE" } });
  await prisma.hoursEntry.create({ data: { userId: karim.id, kind: "RECUP", date: d("2026-09-05"), hours: 1, reason: "Récupération après astreinte", status: "DECLARE" } });

  await prisma.absence.create({ data: { userId: lea.id, type: "CONGE", startDate: new Date("2026-09-21"), endDate: new Date("2026-09-25"), motif: "Congés d'automne", status: "DECLARE" } });
  await prisma.absence.create({ data: { userId: karim.id, type: "FORMATION", startDate: new Date("2026-09-17"), endDate: new Date("2026-09-17"), motif: "Certification Kubernetes", status: "VALIDE", paid: false } });

  // Règle récurrente : elle reste virtuelle, le planning la déplie à la volée.
  await prisma.presenceRecurrence.create({ data: { userId: lea.id, effect: "TELETRAVAIL", freq: "WEEKLY", weekday: 4, startDate: new Date("2026-09-01"), motif: "Télétravail du vendredi" } });
  await prisma.travelEntry.create({ data: { userId: marion.id, startDate: d("2026-09-08"), endDate: d("2026-09-08"), destination: "Top Formation, Lyon", motif: "Atelier de cadrage", status: "DECLARE" } });
  // PlannedShift is looked up by exact date equality against midnight-UTC values
  // (currentWeekdays() in src/lib/format.ts), unlike the T09:00 convention `d()`
  // uses elsewhere — so these two use a plain date, not `d(...)`.
  await prisma.plannedShift.create({ data: { userId: lea.id, date: new Date("2026-09-02"), kind: "TELETRAVAIL" } });
  await prisma.plannedShift.create({ data: { userId: karim.id, date: new Date("2026-09-03"), kind: "CLIENT", note: "Sur site Oxy" } });

  // ---------- Decisions (Pilotage) ----------
  const decisionDefs = [
    { date: "2026-08-27", who: claire, title: "Oxy — livraison au périmètre initial", detail: "Marge à −9 % et demandes ajoutées en continu. Le périmètre vendu est livré ; toute demande supplémentaire passe par un avenant.", impact: "périmètre gelé · 6 h de dépassement absorbées", tag: "Arbitrage" },
    { date: "2026-08-25", who: claire, title: "Groupe Lantier — démarrage décalé à mi-octobre", detail: "Capacité dev à 92 % en octobre si Lantier et Selva démarrent ensemble. Le client accepte le décalage.", impact: "pas de renfort freelance · 30 k€ maintenus", tag: "Charge" },
    { date: "2026-08-21", who: marion, title: "Top Formation — avenant export Excel à 1 200 €", detail: "Demande hors cahier des charges v3. Chiffrée à 9 h, présentée au point hebdomadaire.", impact: "en attente de validation client", tag: "Commercial" },
    { date: "2026-08-14", who: claire, title: "NCD — relance de la facture de juin par téléphone", detail: "15 jours de retard sur 6 000 €. Appel direct plutôt que relance automatique, pour préserver la relation.", impact: "promesse de règlement au 5 septembre", tag: "Trésorerie" },
    { date: "2026-08-04", who: claire, title: "Grille tarifaire portée à 145 € / h", detail: "Taux moyen constaté à 143 € pour un coût interne de 52 €. Alignement sur les devis en cours.", impact: "appliqué aux devis émis après le 1er sept.", tag: "Tarifs" },
  ];
  for (const dec of decisionDefs) {
    await prisma.decision.create({
      data: { date: d(dec.date), authorId: dec.who.id, title: dec.title, detail: dec.detail, impact: dec.impact, tag: dec.tag },
    });
  }

  // ---------- Temps: time entries (week of 24–28 Aug 2026) ----------
  const weekDays = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
  const projectByLabel: Record<string, typeof aiva | null> = {
    Aiva: aiva, "Top Formation": topFormation, "Mois du Ker": moisDuKer,
    "tous projets": null, prospection: null, Interne: null,
  };
  const weekLogDefs: { who: "Marion" | "Léa" | "Karim"; task: string; project: string; bill: boolean; src: "MANUEL" | "CHRONO"; d: number[] }[] = [
    { who: "Marion", task: "Suivi de projet et recette", project: "Aiva", bill: false, src: "MANUEL", d: [1.5, 1, 1, 0.75, 0] },
    { who: "Marion", task: "Qualification des remontées", project: "tous projets", bill: false, src: "MANUEL", d: [0.75, 0.5, 0, 0, 0] },
    { who: "Marion", task: "Chiffrage avenant A-402", project: "Top Formation", bill: true, src: "CHRONO", d: [0, 1.5, 0, 0, 0] },
    { who: "Marion", task: "Cadrage Groupe Lantier", project: "prospection", bill: false, src: "MANUEL", d: [0, 0, 1, 0, 0] },
    { who: "Léa", task: "Intégration paiement Stripe", project: "Aiva", bill: true, src: "CHRONO", d: [2.5, 3, 2, 0, 0] },
    { who: "Léa", task: "Tableau de bord utilisateur", project: "Aiva", bill: true, src: "CHRONO", d: [0, 0, 0, 1.5, 0] },
    { who: "Léa", task: "Bouton d’inscription inactif sur Safari", project: "Top Formation", bill: true, src: "CHRONO", d: [0, 0, 1.5, 0, 0] },
    { who: "Karim", task: "Intégration des parcours", project: "Top Formation", bill: true, src: "CHRONO", d: [5.5, 0, 0, 0, 0] },
    { who: "Karim", task: "Design et parcours", project: "Mois du Ker", bill: true, src: "CHRONO", d: [0, 4, 2.25, 0, 0] },
    { who: "Karim", task: "Veille technique", project: "Interne", bill: false, src: "MANUEL", d: [0, 0, 0, 1.5, 0] },
  ];
  for (const row of weekLogDefs) {
    const proj = projectByLabel[row.project];
    for (let i = 0; i < row.d.length; i++) {
      if (!row.d[i]) continue;
      await prisma.timeEntry.create({
        data: {
          userId: userByFirst[row.who].id, projectId: proj?.id ?? null, label: row.task,
          date: d(weekDays[i]), hours: row.d[i], billable: row.bill, source: row.src,
        },
      });
    }
  }

  // ---------- Pilotage: cash forecast, team profitability ----------
  const cashInDefs: { month: string; items: { label: string; amount: number; when: string; sure: boolean }[] }[] = [
    { month: "Septembre", items: [
      { label: "Aiva — jalon 3", amount: 12000, when: "échéance 20 sept.", sure: true },
      { label: "NCD — jalon 2 (en retard)", amount: 6000, when: "échue le 10 août", sure: false },
      { label: "Top Formation — jalon 3", amount: 9500, when: "à la mise en production", sure: true },
      { label: "Contrats de maintenance", amount: 1850, when: "prélèvement le 5", sure: true },
    ]},
    { month: "Octobre", items: [
      { label: "Aiva — solde", amount: 12000, when: "à la livraison", sure: true },
      { label: "Tapix — acompte (en retard)", amount: 2400, when: "échue le 5 août", sure: false },
      { label: "Kerlan Immobilier — acompte", amount: 7300, when: "si signature en sept.", sure: false },
      { label: "Contrats de maintenance", amount: 1850, when: "prélèvement le 5", sure: true },
    ]},
    { month: "Novembre", items: [
      { label: "Top Formation — solde", amount: 9500, when: "fin de garantie", sure: true },
      { label: "Groupe Lantier — acompte", amount: 10000, when: "si démarrage mi-oct.", sure: false },
      { label: "Selva — contrat annuel", amount: 7200, when: "décision le 2 sept.", sure: false },
      { label: "Contrats de maintenance", amount: 1850, when: "prélèvement le 5", sure: true },
    ]},
  ];
  for (const month of cashInDefs) {
    for (const [i, item] of month.items.entries()) {
      await prisma.cashForecastItem.create({
        data: { monthLabel: month.month, label: item.label, amount: item.amount, whenLabel: item.when, sure: item.sure, order: i },
      });
    }
  }

  const teamProfitDefs = [
    { user: lea, billableHours: 132, internalHours: 18, ratePct: 88, cost: 6900, revenue: 19800, marginPct: 65, note: "" },
    { user: karim, billableHours: 124, internalHours: 26, ratePct: 83, cost: 7350, revenue: 18600, marginPct: 60, note: "" },
    { user: marion, billableHours: 38, internalHours: 112, ratePct: 25, cost: 8100, revenue: 5700, marginPct: -30, note: "coordination et avant-vente non refacturées" },
    { user: claire, billableHours: 12, internalHours: 138, ratePct: 8, cost: 9200, revenue: 1800, marginPct: -80, note: "direction, prospection, administratif" },
  ];
  for (const tp of teamProfitDefs) {
    await prisma.teamProfitSnapshot.create({
      data: {
        userId: tp.user.id, period: "Août 2026", billableHours: tp.billableHours, internalHours: tp.internalHours,
        billableRatePct: tp.ratePct, cost: tp.cost, revenue: tp.revenue, marginPct: tp.marginPct, note: tp.note,
      },
    });
  }

  // ---------- Prospection: pipeline, contacts, notes, losses ----------
  function kAmount(s: string): number {
    return parseFloat(s.replace(",", ".").replace(" k€", "")) * 1000;
  }
  const contactDefs: Record<string, { first: string; last: string; mail: string; phone?: string; source: string; desc: string; devHours: number; hourlyRate: number }> = {
    "Cabinet Rives": { first: "Hélène", last: "Rives", mail: "h.rives@cabinet-rives.fr", source: "Formulaire du site", desc: "Site vitrine cinq pages avec prise de rendez-vous en ligne. Pas de back-office, contenus gérés par nous.", devHours: 54, hourlyRate: 148 },
    "Atelier Nohan": { first: "Bastien", last: "Nohan", mail: "contact@atelier-nohan.fr", phone: "06 21 44 09 12", source: "Recommandation Aiva", desc: "Boutique en ligne, une centaine de références, paiement Stripe et retrait en atelier.", devHours: 112, hourlyRate: 143 },
    "Groupe Lantier": { first: "Marc", last: "Lantier", mail: "m.lantier@groupe-lantier.com", phone: "02 99 12 88 40", source: "Appel entrant", desc: "Refonte de l’intranet : annuaire, notes de frais, réservation de salles. SSO sur leur Azure AD.", devHours: 210, hourlyRate: 143 },
    "Menuiserie Delaunay": { first: "Yann", last: "Delaunay", mail: "y.delaunay@menuiserie-delaunay.fr", source: "Salon Artibat", desc: "Site vitrine et configurateur de fenêtres avec devis automatique par e-mail.", devHours: 84, hourlyRate: 143 },
    Selva: { first: "Inès", last: "Marchetti", mail: "i.marchetti@selva.fr", phone: "04 78 33 21 07", source: "Client existant", desc: "Contrat de maintenance annuel du catalogue : 5 h par mois, correctifs et petites évolutions.", devHours: 60, hourlyRate: 120 },
    "Top Formation": { first: "Sophie", last: "Renard", mail: "s.renard@topformation.fr", phone: "01 55 09 74 12", source: "Client existant", desc: "Forfait annuel d’évolutions : exports, tableaux de bord formateurs, intégrations à la demande.", devHours: 190, hourlyRate: 147 },
    Oxy: { first: "Paul", last: "Adam", mail: "p.adam@oxy.studio", source: "Client existant", desc: "Phase 2 : ouverture d’une boutique en ligne sur le site refondu.", devHours: 76, hourlyRate: 145 },
    "Kerlan Immobilier": { first: "Camille", last: "Kerlan", mail: "c.kerlan@kerlan-immo.fr", phone: "02 97 40 18 55", source: "Recommandation NCD", desc: "Portail locataires : quittances, demandes d’intervention, documents. Connecté à leur logiciel de gestion.", devHours: 154, hourlyRate: 143 },
    "Studio Verne": { first: "Léo", last: "Verne", mail: "leo@studioverne.com", source: "Instagram", desc: "Refonte de l’identité et site portfolio. Périmètre encore à resserrer.", devHours: 98, hourlyRate: 143 },
  };
  const lossDetailDefs: Record<string, { reason: string; date: string; detail: string; by: string }> = {
    "Vialis Conseil": { reason: "Prix", date: "2026-08-12", detail: "Écart de 6 k€ avec le prestataire retenu. Ils gardaient un budget serré et n’ont pas voulu réduire le périmètre.", by: "Marion L." },
    "Brasserie Tannay": { reason: "Concurrent", date: "2026-07-30", detail: "Partis chez une agence locale déjà en charge de leur identité visuelle. Prix comparable.", by: "Claire V." },
    "Foncière Marest": { reason: "Sans réponse", date: "2026-07-02", detail: "Trois relances sans retour après l’envoi du devis. Le contact a changé de poste entre-temps.", by: "Marion L." },
    "Coop Sainte-Anne": { reason: "Projet reporté", date: "2026-06-21", detail: "Budget décalé à l’exercice suivant. À reprendre en janvier, ils ont demandé à rester en contact.", by: "Claire V." },
  };
  const dealNoteDefs: Record<string, { who: typeof marion; text: string }[]> = {
    "Groupe Lantier": [
      { who: marion, text: "Atelier de cadrage confirmé au 2 septembre, trois personnes de leur côté dont le DSI. Ils veulent le SSO Azure AD dès la première version." },
      { who: claire, text: "Marc a mentionné un budget de 30 à 35 k€. Ne pas descendre sous 30, ils comparent avec un intégrateur plus cher." },
      { who: marion, text: "Premier appel : l’intranet actuel date de 2016, personne ne s’en sert. Vraie douleur sur les notes de frais." },
    ],
    "Kerlan Immobilier": [
      { who: claire, text: "Deuxième round terminé. Ils acceptent le prix si on livre le portail avant fin novembre. À vérifier avec la charge dev." },
      { who: marion, text: "Camille demande une démonstration du portail NCD, qui est proche du besoin. Prévue vendredi." },
    ],
    "Studio Verne": [{ who: marion, text: "Périmètre encore flou : ils hésitent entre portfolio simple et boutique. Proposition en deux lots pour débloquer." }],
    Selva: [{ who: marion, text: "Décision annoncée pour le 2 septembre. Inès est favorable, ça passe en comité." }],
    "Menuiserie Delaunay": [{ who: marion, text: "Rencontré à Artibat. Configurateur de fenêtres : demander les grilles tarifaires avant de chiffrer." }],
  };
  const pipeDefs: { stage: "CONTACT" | "QUALIFIE" | "DEVIS" | "NEGOCIATION" | "SIGNE" | "REFUSE"; deals: { name: string; amount: string; note: string; next: string; prob: string; project?: typeof aiva }[] }[] = [
    { stage: "CONTACT", deals: [
      { name: "Cabinet Rives", amount: "8 k€", note: "Site vitrine · entrant formulaire", next: "Appel jeudi", prob: "10 %" },
      { name: "Atelier Nohan", amount: "16 k€", note: "Boutique en ligne · recommandation Aiva", next: "Rappeler lundi", prob: "15 %" },
    ]},
    { stage: "QUALIFIE", deals: [
      { name: "Groupe Lantier", amount: "30 k€", note: "Refonte intranet · besoin confirmé", next: "Atelier 2 sept.", prob: "35 %" },
      { name: "Menuiserie Delaunay", amount: "12 k€", note: "Site + configurateur", next: "Relance à envoyer", prob: "25 %" },
    ]},
    { stage: "DEVIS", deals: [
      { name: "Selva", amount: "7 k€", note: "Contrat maintenance annuel", next: "Décision 2 sept.", prob: "70 %" },
      { name: "Top Formation", amount: "28 k€", note: "Forfait annuel évolutions", next: "Relecture en cours", prob: "55 %" },
      { name: "Oxy", amount: "11 k€", note: "Phase 2 · e-commerce", next: "Attente budget", prob: "40 %" },
    ]},
    { stage: "NEGOCIATION", deals: [
      { name: "Kerlan Immobilier", amount: "22 k€", note: "Portail locataires · 2e round", next: "Signature attendue", prob: "80 %" },
      { name: "Studio Verne", amount: "14 k€", note: "Refonte identité + site", next: "Ajuster le périmètre", prob: "60 %" },
    ]},
    { stage: "SIGNE", deals: [
      { name: "Aiva", amount: "36 k€", note: "Refonte plateforme", next: "Démarré 4 juin", prob: "100 %", project: aiva },
      { name: "Top Formation", amount: "28,5 k€", note: "Plateforme e-learning", next: "En cours", prob: "100 %", project: topFormation },
      { name: "Tapix", amount: "18 k€", note: "App mobile V2", next: "En cours", prob: "100 %", project: tapix },
      { name: "Mois du Ker", amount: "9,8 k€", note: "Site événementiel", next: "En cours", prob: "100 %", project: moisDuKer },
      { name: "NCD", amount: "3,7 k€", note: "Avenant portail fournisseurs", next: "Livré", prob: "100 %", project: ncd },
    ]},
    { stage: "REFUSE", deals: [
      { name: "Vialis Conseil", amount: "19 k€", note: "Extranet client · devis D-402", next: "Perdu le 12 août", prob: "0 %" },
      { name: "Brasserie Tannay", amount: "9 k€", note: "Site + réservation", next: "Perdu le 30 juil.", prob: "0 %" },
      { name: "Foncière Marest", amount: "25 k€", note: "Portail locataires", next: "Sans réponse depuis le 2 juil.", prob: "0 %" },
      { name: "Coop Sainte-Anne", amount: "13 k€", note: "Boutique en ligne adhérents", next: "Perdu le 21 juin", prob: "0 %" },
    ]},
  ];
  let dealOrder = 0;
  for (const col of pipeDefs) {
    for (const dl of col.deals) {
      const contact = contactDefs[dl.name];
      const loss = lossDetailDefs[dl.name];
      const deal = await prisma.deal.create({
        data: {
          name: dl.name, stage: col.stage, amount: kAmount(dl.amount), order: dealOrder++,
          note: dl.note, nextAction: dl.next, probabilityPct: parseInt(dl.prob, 10),
          contactFirst: contact?.first, contactLast: contact?.last, contactEmail: contact?.mail, contactPhone: contact?.phone,
          source: contact?.source, description: contact?.desc ?? "", devHours: contact?.devHours, hourlyRate: contact?.hourlyRate,
          lossReason: loss?.reason, lossDetail: loss?.detail, lostAt: loss ? d(loss.date) : null, lostBy: loss?.by,
          projectId: dl.project?.id,
        },
      });
      const notes = dealNoteDefs[dl.name];
      if (notes) {
        for (const n of notes) {
          await prisma.dealNote.create({ data: { dealId: deal.id, authorId: n.who.id, body: n.text } });
        }
      }
    }
  }

  // ---------- À traiter (Dirigeante) ----------
  const actionDefs: { category: "URGENT" | "RELANCE" | "DECISION"; tag: string; title: string; detail: string; due: string; amount: string; cta: string; project?: typeof aiva }[] = [
    { category: "URGENT", tag: "IMPAYÉ", title: "Relancer NCD — facture F-2604", detail: "Échue depuis 15 jours. Deux relances automatiques envoyées, sans réponse. Troisième relance à faire par téléphone.", due: "J+15", amount: "6 000 €", cta: "Appeler", project: ncd },
    { category: "URGENT", tag: "IMPAYÉ", title: "Relancer Tapix — acompte F-2601", detail: "Échue depuis 20 jours. Le projet continue sans encaissement de l’acompte.", due: "J+20", amount: "2 400 €", cta: "Relancer", project: tapix },
    { category: "URGENT", tag: "MARGE", title: "Arbitrer le dépassement Oxy", detail: "31 h consommées sur 25 h vendues, marge à −9 %. Soit un avenant, soit on stoppe le périmètre supplémentaire.", due: "aujourd’hui", amount: "−1 100 €", cta: "Décider", project: oxy },
    { category: "URGENT", tag: "CAPACITÉ", title: "Capacité dev à 92 % en octobre", detail: "Groupe Lantier et Selva démarreraient en même temps. Décaler un démarrage ou recruter un freelance.", due: "avant le 5 sept.", amount: "52 k€ concernés", cta: "Planifier" },
    { category: "RELANCE", tag: "GARANTIE", title: "Proposer le contrat de maintenance à Selva", detail: "Fin de garantie dans 8 jours. Proposition prête, il manque votre validation avant envoi.", due: "avant le 2 sept.", amount: "600 € / mois", cta: "Valider" },
    { category: "RELANCE", tag: "DEVIS", title: "Relancer Menuiserie Delaunay", detail: "Devis envoyé il y a 12 jours, aucune réponse. Relance rédigée par l’IA, en attente d’envoi.", due: "J+12", amount: "12 000 €", cta: "Envoyer" },
    { category: "RELANCE", tag: "DEVIS", title: "Suivre la négociation Kerlan Immobilier", detail: "Deuxième round terminé, signature annoncée pour cette semaine. Confirmer la date de démarrage.", due: "vendredi", amount: "22 000 €", cta: "Appeler" },
    { category: "RELANCE", tag: "UPSELL", title: "Cadrer le forfait annuel Top Formation", detail: "Deux avenants signés en deux mois. Un forfait mensuel sécuriserait le récurrent.", due: "la semaine prochaine", amount: "28 000 €", cta: "Préparer", project: topFormation },
    { category: "DECISION", tag: "DEVIS", title: "Valider le devis Aiva — avenant export Excel", detail: "9 h à 1 200 €. Le client attend la réponse depuis hier.", due: "aujourd’hui", amount: "1 200 €", cta: "Valider", project: aiva },
    { category: "DECISION", tag: "OBJECTIF", title: "Trancher les 34 k€ restants du T3", detail: "96 k€ signés sur 130 k€, 5 semaines restantes. Kerlan et Selva suffisent si les deux closent.", due: "revue lundi", amount: "34 000 €", cta: "Revoir" },
    { category: "DECISION", tag: "ÉQUIPE", title: "Entretien trimestriel — Léa Mercier", detail: "À planifier avant fin septembre. Taux facturable à 88 %, au-dessus de l’objectif.", due: "sept.", amount: "", cta: "Planifier" },
  ];
  for (const a of actionDefs) {
    await prisma.actionItem.create({
      data: { category: a.category, tag: a.tag, title: a.title, detail: a.detail, dueLabel: a.due, amountLabel: a.amount, ctaLabel: a.cta, linkedProjectId: a.project?.id },
    });
  }

  // ---------- Client portal: Quote + CDC for Top Formation ----------
  const quote = await prisma.quote.create({
    data: {
      projectId: topFormation.id, ref: "D-388", signedAt: d("2025-05-12"),
      totalAmount: 28500, totalHt: 23750, hoursSold: 190, hourlyRate: 125, paidAmount: 19000,
    },
  });
  const quoteLineDefs = [
    { label: "Cadrage et maquettes", detail: "8 écrans validés le 8 juillet", hours: 28, amount: 3500 },
    { label: "Socle technique et comptes", detail: "authentification, rôles, back-office", hours: 46, amount: 5750 },
    { label: "Catalogue de formations et recherche", detail: "filtres, recherche à la frappe", hours: 38, amount: 4750 },
    { label: "Inscription des apprenants", detail: "tunnel en 3 étapes, e-mails de confirmation", hours: 32, amount: 4000 },
    { label: "Paiement et facturation", detail: "Stripe, factures PDF, relances", hours: 30, amount: 3750 },
    { label: "Recette, mise en production, formation", detail: "2 semaines de recette, 1 journée de formation", hours: 16, amount: 2000 },
  ];
  for (const [i, l] of quoteLineDefs.entries()) {
    await prisma.quoteLine.create({ data: { quoteId: quote.id, label: l.label, detail: l.detail, hours: l.hours, amount: l.amount, order: i } });
  }
  await prisma.quoteLine.create({ data: { quoteId: quote.id, ref: "A-402", label: "Export Excel des résultats", detail: "avenant", hours: 9, amount: 1200, status: "en attente de votre validation", order: 6 } });
  await prisma.quoteLine.create({ data: { quoteId: quote.id, ref: "A-398", label: "Tableau de bord formateur", detail: "avenant", hours: 14, amount: 1750, status: "validé le 2 août", order: 7 } });

  const scheduleDefs = [
    { label: "Acompte à la signature", amount: 9500, when: "12 mai", paid: true },
    { label: "À la validation des maquettes", amount: 9500, when: "10 juillet", paid: true },
    { label: "À la mise en production", amount: 9500, when: "prévu 18 septembre", paid: false },
  ];
  for (const [i, s] of scheduleDefs.entries()) {
    await prisma.paymentScheduleItem.create({ data: { quoteId: quote.id, label: s.label, amount: s.amount, whenLabel: s.when, paid: s.paid, order: i } });
  }

  const specSections = [
    { n: "1", title: "Contexte et objectifs", body: "Top Formation gère aujourd’hui ses inscriptions par e-mail et tableur. La plateforme doit permettre aux apprenants de s’inscrire seuls, aux formateurs de suivre leurs sessions, et à l’administration de facturer sans ressaisie. Objectif : 80 % des inscriptions en autonomie à six mois." },
    { n: "2", title: "Utilisateurs et rôles", body: "Trois rôles : apprenant, formateur, administrateur. L’apprenant consulte le catalogue, s’inscrit et paie. Le formateur voit ses sessions et les résultats de ses apprenants. L’administrateur gère le catalogue, les sessions, la facturation et les comptes." },
    { n: "3", title: "Parcours d’inscription", body: "Trois étapes : identité, coordonnées et prise en charge, paiement. L’état est sauvegardé entre les étapes pour permettre une reprise après abandon. Un e-mail de confirmation part immédiatement, la convention de formation suit sous 24 h." },
    { n: "4", title: "Paiement et facturation", body: "Carte bancaire via Stripe, paiement en trois fois au-delà de 600 €. Facture PDF disponible dans l’espace apprenant et envoyée par e-mail. Relance automatique à 4 h puis 24 h en cas d’abandon du paiement." },
    { n: "5", title: "Contraintes techniques", body: "Hébergement en France, données conservées trois ans après la dernière session. Compatibilité Chrome, Firefox, Safari et Edge sur les deux dernières versions majeures. Accessibilité : contrastes et navigation clavier sur les parcours d’inscription." },
    { n: "6", title: "Hors périmètre", body: "Application mobile, visioconférence intégrée, connexion au logiciel comptable et export Excel des résultats ne font pas partie du forfait initial. Ces éléments feront l’objet d’avenants chiffrés séparément." },
  ];
  await prisma.cdcDocument.create({
    data: {
      projectId: topFormation.id, name: "Cahier des charges — v3", version: "Version 3 · 14 juin 2025",
      meta: "rédigé par Marion Lefèvre, validé par Sophie Renard", status: "En vigueur",
      sections: JSON.stringify(specSections), order: 0,
    },
  });
  const specFiles = [
    { name: "Cahier des charges — v2.pdf", meta: "PDF · 1,2 Mo · 2 juin 2025", status: "Archivé", order: 1 },
    { name: "Devis D-388 signé.pdf", meta: "PDF · 320 Ko · 12 mai 2025", status: "Signé", order: 2 },
    { name: "Avenant A-398 signé.pdf", meta: "PDF · 180 Ko · 2 août 2025", status: "Signé", order: 3 },
    { name: "Avenant A-402.pdf", meta: "PDF · 175 Ko · 27 août 2025", status: "À valider", order: 4 },
  ];
  for (const f of specFiles) {
    await prisma.cdcDocument.create({ data: { projectId: topFormation.id, name: f.name, version: "", meta: f.meta, status: f.status, order: f.order } });
  }

  // ---------- Client portal: Rendez-vous (Top Formation) ----------
  await prisma.rdv.create({
    data: {
      projectId: topFormation.id, whenAt: d("2026-09-01"), whereLabel: "Google Meet · lien envoyé la veille",
      hostId: marion.id, cadence: "Point hebdomadaire · tous les mardis à 10 h",
      agenda: JSON.stringify([
        { label: "Avancement du sprint 4", detail: "paiement Stripe et page de confirmation", from: "automatique" },
        { label: "Facture PDF vide au-delà de 2 pages", detail: "correctif en revue, à valider ensemble", from: "ticket R-117" },
        { label: "Export Excel des résultats", detail: "avenant A-402 · 9 h · 1 200 €", from: "devis en attente" },
        { label: "Recette client du 8 au 18 septembre", detail: "qui teste, sur quels parcours", from: "ajouté par Marion" },
      ]),
    },
  });
  const pastRdvDefs = [
    { when: "2026-08-25", note: "Bug Safari qualifié bloquant. Avenant export Excel présenté.", summary: "3 points traités" },
    { when: "2026-08-18", note: "Validation des maquettes du tunnel de paiement.", summary: "2 points traités" },
    { when: "2026-08-11", note: "Point budget : 188 h consommées sur 260.", summary: "4 points traités" },
  ];
  for (const p of pastRdvDefs) {
    await prisma.rdv.create({
      data: { projectId: topFormation.id, whenAt: d(p.when), whereLabel: "Google Meet", hostId: marion.id, cadence: "Point hebdomadaire", agenda: "[]", isPast: true, summary: `${p.note} · ${p.summary}` },
    });
  }
  // ---------- Client portal: échanges avec la cheffe de projet ----------
  const clientThreadDefs = [
    { fromClient: false, authorLabel: "Marion Lefèvre", body: "Les six premiers modules sont en ligne sur la préprod. Vous pouvez commencer à les parcourir." },
    { fromClient: true, authorLabel: "Sophie Renard", body: "Parfait. Le module 4 affiche encore l’ancien logo, c’est normal à ce stade ?" },
    { fromClient: false, authorLabel: "Marion Lefèvre", body: "Non, c’est un oubli. Je l’ai ajouté en tâche, corrigé avant vendredi." },
    { fromClient: false, authorLabel: "Marion Lefèvre", body: "Point de la semaine : 62 % d’avancement, on reste sur la mise en ligne au 30 septembre." },
  ];
  for (const m of clientThreadDefs) {
    await prisma.clientThreadMessage.create({ data: { projectId: topFormation.id, fromClient: m.fromClient, authorLabel: m.authorLabel, body: m.body } });
  }

  console.log("Seed complete.");
  console.log(`Demo accounts (password: ${DEV_PASSWORD}):`);
  console.log("  claire@codialis.fr  — Dirigeante");
  console.log("  marion@codialis.fr  — Cheffe de projet");
  console.log("  lea@codialis.fr     — Développeuse");
  console.log("  karim@codialis.fr   — Développeur");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
