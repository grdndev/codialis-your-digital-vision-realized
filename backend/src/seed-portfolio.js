// Seed de 50 projets livrés dans le portfolio public (table content, type
// 'portfolio'). Idempotent : un projet dont le titre existe déjà est ignoré,
// on peut donc relancer le script sans créer de doublons.
//
//   npm run db:seed-portfolio            # insère les projets manquants
//   npm run db:seed-portfolio -- --reset # supprime les projets seedés puis réinsère
//
// Aucun projet n'est marqué « à la une » : le projet phare reste celui choisi
// depuis /admin.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { query, pool } from './db.js';

// v = chiffre affiché, l = libellé sous le chiffre (2 max par projet, comme /admin).
const PROJECTS = [
  {
    sector: ['Santé', 'SaaS'],
    title: 'Plateforme de téléconsultation MédiLink',
    desc: `Refonte complète d'une plateforme de téléconsultation : prise de rendez-vous, visio chiffrée, ordonnances électroniques et facturation tiers payant. Architecture hébergée sur données de santé (HDS) et pics de charge absorbés sans dégradation.`,
    results: [{ v: '+120 k', l: 'consultations / an' }, { v: '-45 %', l: 'temps de prise en charge' }],
    tech: ['React', 'Node.js', 'WebRTC', 'PostgreSQL', 'AWS'],
  },
  {
    sector: ['Finance', 'Application mobile'],
    title: 'Application mobile de gestion de trésorerie Trezo',
    desc: `Application iOS et Android permettant aux dirigeants de TPE/PME de suivre leur trésorerie en temps réel, avec agrégation bancaire, prévisionnel à 90 jours et alertes de découvert.`,
    results: [{ v: '18 k', l: 'utilisateurs actifs' }, { v: '4,8/5', l: 'note sur les stores' }],
    tech: ['React Native', 'NestJS', 'Open Banking', 'MySQL'],
  },
  {
    sector: ['Logistique', 'IA'],
    title: `Optimisation de tournées par IA pour Transflux`,
    desc: `Moteur d'optimisation de tournées de livraison combinant contraintes horaires, capacités véhicules et trafic temps réel. Les plannings sont recalculés en continu et poussés aux chauffeurs sur mobile.`,
    results: [{ v: '-22 %', l: 'kilomètres parcourus' }, { v: '+31 %', l: 'livraisons par tournée' }],
    tech: ['Python', 'OR-Tools', 'FastAPI', 'Redis', 'Mapbox'],
  },
  {
    sector: ['Industrie', 'ERP'],
    title: 'ERP de production sur mesure pour Métalor',
    desc: `Remplacement d'un parc de fichiers Excel par un ERP métier : ordres de fabrication, suivi d'atelier par QR code, gestion des stocks matières et calcul automatique des coûts de revient.`,
    results: [{ v: '-60 %', l: 'saisies manuelles' }, { v: '9 sites', l: 'déployés' }],
    tech: ['Vue.js', 'Laravel', 'MySQL', 'Docker'],
  },
  {
    sector: ['Retail', 'E-commerce'],
    title: 'Marketplace multi-vendeurs Boutik',
    desc: `Marketplace B2C avec catalogue mutualisé, paiements scindés entre vendeurs, gestion des litiges et tableau de bord vendeur. Mise en production en quatre mois, ouverte à 300 marchands.`,
    results: [{ v: '2,4 M€', l: 'de GMV la première année' }, { v: '300', l: 'vendeurs actifs' }],
    tech: ['Next.js', 'Stripe Connect', 'PostgreSQL', 'Algolia'],
  },
  {
    sector: ['Éducation', 'SaaS'],
    title: 'LMS Skolar pour organismes de formation',
    desc: `Plateforme de formation en ligne conforme Qualiopi : parcours pédagogiques, quiz notés, émargement électronique, génération des attestations et export des données de suivi pour les audits.`,
    results: [{ v: '45 k', l: 'apprenants formés' }, { v: '100 %', l: 'audits Qualiopi validés' }],
    tech: ['React', 'Node.js', 'MongoDB', 'S3'],
  },
  {
    sector: ['Immobilier', 'CRM'],
    title: 'CRM transactionnel pour le réseau Habita',
    desc: `CRM immobilier centralisant mandats, acquéreurs et visites, avec rapprochement automatique offre/demande, signature électronique des mandats et diffusion multi-portails des annonces.`,
    results: [{ v: '+28 %', l: 'de mandats signés' }, { v: '14 agences', l: 'connectées' }],
    tech: ['Angular', 'Spring Boot', 'PostgreSQL', 'Docusign'],
  },
  {
    sector: ['Tourisme', 'Application mobile'],
    title: 'Application de réservation Escapada',
    desc: `Application de réservation de séjours de dernière minute avec moteur de recherche géolocalisé, paiement en trois fois et carnet de voyage hors ligne synchronisé au retour du réseau.`,
    results: [{ v: '210 k', l: 'téléchargements' }, { v: '-38 %', l: 'abandons au paiement' }],
    tech: ['Flutter', 'Firebase', 'Node.js', 'Stripe'],
  },
  {
    sector: ['RH', 'SaaS'],
    title: 'SIRH Talentis pour PME multi-sites',
    desc: `SIRH couvrant congés, notes de frais, entretiens annuels et registre du personnel, avec workflows de validation configurables par entité et export paie automatisé.`,
    results: [{ v: '1 800', l: 'salariés gérés' }, { v: '-70 %', l: 'de traitement administratif' }],
    tech: ['React', 'NestJS', 'PostgreSQL', 'Kubernetes'],
  },
  {
    sector: ['Juridique', 'IA'],
    title: `Analyse documentaire IA pour le cabinet Lexia`,
    desc: `Outil d'analyse de contrats : extraction des clauses sensibles, détection des écarts par rapport aux modèles du cabinet et résumé structuré, avec citation systématique du passage source.`,
    results: [{ v: '-65 %', l: 'temps de revue contractuelle' }, { v: '12 k', l: 'contrats analysés' }],
    tech: ['Python', 'Claude API', 'pgvector', 'FastAPI'],
  },
  {
    sector: ['Énergie', 'IoT'],
    title: 'Supervision énergétique Voltix',
    desc: `Plateforme de supervision de sites industriels : collecte de compteurs par passerelles LoRaWAN, détection des dérives de consommation et rapports réglementaires générés automatiquement.`,
    results: [{ v: '-17 %', l: 'de consommation annuelle' }, { v: '640', l: 'capteurs supervisés' }],
    tech: ['Go', 'TimescaleDB', 'MQTT', 'Grafana'],
  },
  {
    sector: ['Agroalimentaire', 'Traçabilité'],
    title: 'Traçabilité de lots pour Terroir Direct',
    desc: `Système de traçabilité de la parcelle au point de vente : saisie terrain hors ligne, généalogie des lots et fiche produit publique accessible par QR code sur l'emballage.`,
    results: [{ v: '100 %', l: 'des lots traçables' }, { v: '< 2 min', l: 'pour un rappel produit' }],
    tech: ['React Native', 'Node.js', 'PostgreSQL', 'Redis'],
  },
  {
    sector: ['BTP', 'Application mobile'],
    title: 'Suivi de chantier mobile Bativue',
    desc: `Application de suivi de chantier pour conducteurs de travaux : rapports photo horodatés, pointage des équipes, réserves de réception et génération du compte rendu PDF signé sur site.`,
    results: [{ v: '230', l: 'chantiers suivis' }, { v: '-50 %', l: 'de litiges de réception' }],
    tech: ['Flutter', 'NestJS', 'MySQL', 'S3'],
  },
  {
    sector: ['Assurance', 'SaaS'],
    title: 'Parcours de souscription en ligne Assuria',
    desc: `Tunnel de souscription 100 % en ligne pour un courtier : tarification temps réel, contrôle d'éligibilité, signature électronique et création du contrat dans le back-office existant.`,
    results: [{ v: '+41 %', l: 'de taux de conversion' }, { v: '6 min', l: 'pour souscrire' }],
    tech: ['Next.js', 'Node.js', 'PostgreSQL', 'Yousign'],
  },
  {
    sector: ['Transport', 'SaaS'],
    title: 'Portail voyageurs Mobilis',
    desc: `Portail d'information voyageurs d'un réseau urbain : horaires temps réel, calcul d'itinéraires, alertes de perturbation et espace abonné pour le renouvellement des titres.`,
    results: [{ v: '90 k', l: 'visites mensuelles' }, { v: '99,95 %', l: 'de disponibilité' }],
    tech: ['React', 'GTFS-RT', 'Go', 'Redis'],
  },
  {
    sector: ['Médias', 'SaaS'],
    title: 'Régie publicitaire Adflow',
    desc: `Outil de gestion de régie : planification des campagnes, contrôle de l'inventaire disponible, facturation automatique et reporting de performance par annonceur.`,
    results: [{ v: '3,1 M€', l: 'de campagnes pilotées' }, { v: '-80 %', l: 'de tâches de facturation' }],
    tech: ['Vue.js', 'Laravel', 'MySQL', 'ClickHouse'],
  },
  {
    sector: ['Sport', 'Application mobile'],
    title: 'Application de club Sportea',
    desc: `Application blanche pour clubs sportifs : convocations, feuilles de match, licences dématérialisées et boutique interne, déclinée automatiquement à la charte de chaque club.`,
    results: [{ v: '60 clubs', l: 'équipés' }, { v: '27 k', l: 'licenciés actifs' }],
    tech: ['React Native', 'Firebase', 'NestJS'],
  },
  {
    sector: ['Associatif', 'CRM'],
    title: 'CRM donateurs pour la fondation Ensemble',
    desc: `CRM de collecte de fonds : suivi des donateurs, dons récurrents, génération des reçus fiscaux et segmentation des campagnes d'appel à dons.`,
    results: [{ v: '+34 %', l: 'de dons récurrents' }, { v: '52 k', l: 'reçus fiscaux émis' }],
    tech: ['React', 'Node.js', 'PostgreSQL', 'Brevo'],
  },
  {
    sector: ['Collectivités', 'SaaS'],
    title: 'Guichet unique citoyen Ville+',
    desc: `Guichet numérique d'une commune : demandes d'actes d'état civil, inscriptions périscolaires, signalements de voirie et suivi des dossiers, avec accessibilité RGAA vérifiée.`,
    results: [{ v: '38 k', l: 'démarches en ligne' }, { v: 'RGAA AA', l: 'conformité atteinte' }],
    tech: ['Next.js', 'NestJS', 'PostgreSQL', 'FranceConnect'],
  },
  {
    sector: ['Santé', 'IA'],
    title: 'Aide au codage médical CodeSanté',
    desc: `Assistant de codage des séjours hospitaliers : proposition de codes CIM-10 à partir des comptes rendus, avec justification textuelle et validation humaine obligatoire avant transmission.`,
    results: [{ v: '+19 %', l: 'de recettes valorisées' }, { v: '-40 %', l: 'temps de codage' }],
    tech: ['Python', 'Claude API', 'FastAPI', 'PostgreSQL'],
  },
  {
    sector: ['E-commerce', 'Performance'],
    title: `Refonte performance de la boutique Maison Verte`,
    desc: `Migration d'une boutique monolithique vers une architecture découplée avec rendu statique, cache CDN et paiement optimisé mobile. Budget performance suivi à chaque déploiement.`,
    results: [{ v: '1,1 s', l: 'de LCP mobile' }, { v: '+26 %', l: 'de chiffre par visite' }],
    tech: ['Next.js', 'Shopify', 'Vercel', 'Cloudflare'],
  },
  {
    sector: ['Finance', 'SaaS'],
    title: 'Plateforme de recouvrement Recouvr',
    desc: `Plateforme de recouvrement amiable : scénarios de relance multicanaux, scoring de solvabilité, plans de paiement en ligne et piste d'audit complète des échanges.`,
    results: [{ v: '+37 %', l: 'de créances recouvrées' }, { v: '-11 j', l: 'de DSO moyen' }],
    tech: ['React', 'NestJS', 'PostgreSQL', 'Twilio'],
  },
  {
    sector: ['Industrie', 'IA'],
    title: 'Contrôle qualité par vision pour Precitec',
    desc: `Contrôle qualité en ligne de production par vision industrielle : détection des défauts de surface sur bande à 12 images par seconde et rejet automatique des pièces non conformes.`,
    results: [{ v: '99,3 %', l: 'de défauts détectés' }, { v: '-62 %', l: 'de retours clients' }],
    tech: ['Python', 'PyTorch', 'OpenCV', 'NVIDIA Jetson'],
  },
  {
    sector: ['RH', 'IA'],
    title: 'Pré-qualification de candidatures Hirely',
    desc: `Outil de pré-qualification : structuration des CV, mise en correspondance avec la fiche de poste et synthèse pour le recruteur. Critères discriminants exclus du modèle par conception.`,
    results: [{ v: '-55 %', l: 'temps de tri des CV' }, { v: '24 k', l: 'candidatures traitées' }],
    tech: ['Python', 'Claude API', 'Django', 'PostgreSQL'],
  },
  {
    sector: ['Logistique', 'SaaS'],
    title: 'WMS entrepôt Stokia',
    desc: `Système de gestion d'entrepôt : réception, adressage dynamique, préparation par vagues sur terminaux Android et inventaires tournants sans arrêt d'activité.`,
    results: [{ v: '+44 %', l: 'de lignes préparées / heure' }, { v: '99,8 %', l: 'de fiabilité stock' }],
    tech: ['React', 'Node.js', 'PostgreSQL', 'Zebra'],
  },
  {
    sector: ['Immobilier', 'IA'],
    title: 'Estimation automatisée Valorim',
    desc: `Moteur d'estimation de biens résidentiels croisant DVF, caractéristiques du bien et signaux de marché locaux, avec fourchette de confiance et rapport téléchargeable.`,
    results: [{ v: '±4,2 %', l: `d'erreur médiane` }, { v: '75 k', l: 'estimations produites' }],
    tech: ['Python', 'scikit-learn', 'FastAPI', 'PostGIS'],
  },
  {
    sector: ['Éducation', 'Application mobile'],
    title: 'Application de révision Studia',
    desc: `Application de révision par répétition espacée pour lycéens : fiches collaboratives, mode hors ligne complet et suivi de progression partagé avec les enseignants.`,
    results: [{ v: '130 k', l: 'élèves inscrits' }, { v: '+2,1 pts', l: 'de moyenne constatée' }],
    tech: ['React Native', 'GraphQL', 'Node.js', 'MongoDB'],
  },
  {
    sector: ['Santé', 'ERP'],
    title: `Gestion de pharmacie d'officine Pharmix`,
    desc: `Logiciel de gestion d'officine : commandes fournisseurs automatisées sur seuils, gestion des périmés, traçabilité des lots et interface avec les grossistes répartiteurs.`,
    results: [{ v: '-28 %', l: 'de stock immobilisé' }, { v: '31 officines', l: 'équipées' }],
    tech: ['Electron', 'Node.js', 'SQLite', 'MySQL'],
  },
  {
    sector: ['Tourisme', 'SaaS'],
    title: 'Channel manager Hôtelia',
    desc: `Channel manager pour hôtellerie indépendante : synchronisation tarifs et disponibilités avec les OTA, yield management assisté et moteur de réservation en direct sans commission.`,
    results: [{ v: '+23 %', l: 'de réservations directes' }, { v: '0', l: 'surbooking en 18 mois' }],
    tech: ['Vue.js', 'Symfony', 'MySQL', 'RabbitMQ'],
  },
  {
    sector: ['Finance', 'Conformité'],
    title: 'Vérification KYC Complya',
    desc: `Parcours de vérification d'identité et de conformité : contrôle documentaire, filtrage des listes de sanctions, détection des personnes politiquement exposées et dossier d'audit horodaté.`,
    results: [{ v: '92 s', l: 'de vérification moyenne' }, { v: '100 %', l: `de contrôles journalisés` }],
    tech: ['Node.js', 'React', 'PostgreSQL', 'Onfido'],
  },
  {
    sector: ['Retail', 'IA'],
    title: 'Prévision de la demande pour Frescoo',
    desc: `Prévision de ventes par magasin et par référence sur produits frais, intégrant météo, promotions et saisonnalité, avec propositions de commande ajustables par les responsables.`,
    results: [{ v: '-31 %', l: 'de démarque' }, { v: '+8 %', l: 'de marge sur le frais' }],
    tech: ['Python', 'Prophet', 'Airflow', 'BigQuery'],
  },
  {
    sector: ['Industrie', 'IoT'],
    title: 'Maintenance prédictive Mecalys',
    desc: `Surveillance vibratoire de machines tournantes : collecte haute fréquence en périphérie, détection d'anomalies et ouverture automatique d'ordres de maintenance dans la GMAO.`,
    results: [{ v: '-47 %', l: `d'arrêts non planifiés` }, { v: '180', l: 'machines instrumentées' }],
    tech: ['Rust', 'MQTT', 'TimescaleDB', 'Python'],
  },
  {
    sector: ['Juridique', 'SaaS'],
    title: 'Gestion de dossiers Avoca',
    desc: `Outil de gestion de cabinet : dossiers, délais de procédure, temps passé, facturation au forfait ou à l'heure, et coffre-fort documentaire chiffré partagé avec le client.`,
    results: [{ v: '+21 %', l: `d'heures facturables` }, { v: '0', l: 'délai manqué depuis la mise en production' }],
    tech: ['React', 'NestJS', 'PostgreSQL', 'MinIO'],
  },
  {
    sector: ['Énergie', 'SaaS'],
    title: `Portail d'autoconsommation collective Solaris`,
    desc: `Portail de suivi d'une opération d'autoconsommation collective : répartition de la production entre participants, facturation des quotes-parts et restitution pédagogique des économies.`,
    results: [{ v: '410', l: 'foyers raccordés' }, { v: '-24 %', l: 'de facture moyenne' }],
    tech: ['Next.js', 'Node.js', 'PostgreSQL', 'Enedis API'],
  },
  {
    sector: ['Transport', 'Application mobile'],
    title: 'Application chauffeurs Drivio',
    desc: `Application chauffeurs d'une flotte VTC : affectation des courses, navigation intégrée, justificatifs de fin de course et calcul de la rémunération variable en temps réel.`,
    results: [{ v: '1 200', l: 'chauffeurs équipés' }, { v: '-33 %', l: 'de courses annulées' }],
    tech: ['React Native', 'Go', 'PostgreSQL', 'Mapbox'],
  },
  {
    sector: ['Agroalimentaire', 'ERP'],
    title: 'ERP de cave viticole Vinéo',
    desc: `ERP viticole : suivi des cuvées de la vendange à la mise en bouteille, déclarations douanières, gestion des allocations clients et boutique de vente aux particuliers.`,
    results: [{ v: '22 domaines', l: 'déployés' }, { v: '-6 h', l: 'par semaine sur les déclarations' }],
    tech: ['Vue.js', 'Laravel', 'MySQL', 'Docker'],
  },
  {
    sector: ['Santé', 'Application mobile'],
    title: 'Suivi post-opératoire Recovia',
    desc: `Application de suivi post-opératoire : questionnaires quotidiens, photos de cicatrisation, alertes automatiques vers l'équipe soignante en cas de signal préoccupant.`,
    results: [{ v: '-29 %', l: 'de réhospitalisations' }, { v: '8 700', l: 'patients suivis' }],
    tech: ['Flutter', 'NestJS', 'PostgreSQL', 'HDS'],
  },
  {
    sector: ['E-commerce', 'IA'],
    title: 'Assistant de vente conversationnel Shopa',
    desc: `Assistant conversationnel branché sur le catalogue et le stock temps réel : recommandations argumentées, comparaison de produits et transfert vers un conseiller humain sur demande.`,
    results: [{ v: '+17 %', l: 'de panier moyen' }, { v: '-42 %', l: 'de sollicitations du support' }],
    tech: ['Next.js', 'Claude API', 'pgvector', 'Node.js'],
  },
  {
    sector: ['RH', 'SaaS'],
    title: 'Gestion des plannings Shiftly',
    desc: `Planification d'équipes en horaires décalés : génération de plannings respectant le droit du travail et les souhaits des salariés, échanges de créneaux validés par le manager.`,
    results: [{ v: '-75 %', l: 'temps de planification' }, { v: '2 300', l: 'salariés planifiés' }],
    tech: ['React', 'Python', 'OR-Tools', 'PostgreSQL'],
  },
  {
    sector: ['Collectivités', 'IA'],
    title: 'Analyse des signalements de voirie Civix',
    desc: `Classement automatique des signalements citoyens par nature et urgence à partir de la photo et du texte, avec routage vers le service compétent et suivi du délai de traitement.`,
    results: [{ v: '-58 %', l: 'de délai de traitement' }, { v: '41 k', l: 'signalements classés' }],
    tech: ['Python', 'FastAPI', 'PostgreSQL', 'Claude API'],
  },
  {
    sector: ['Finance', 'Application mobile'],
    title: `Application d'épargne automatisée Pilo`,
    desc: `Application d'épargne : arrondi automatique des dépenses, objectifs d'épargne partagés et versements programmés vers des supports d'investissement, avec authentification forte.`,
    results: [{ v: '31 k', l: 'épargnants' }, { v: '9,4 M€', l: 'collectés' }],
    tech: ['React Native', 'NestJS', 'PostgreSQL', 'Open Banking'],
  },
  {
    sector: ['Industrie', 'SaaS'],
    title: 'Portail fournisseurs Suppliz',
    desc: `Portail d'achats industriels : appels d'offres, comparaison des cotations, notation des fournisseurs et suivi des commandes jusqu'à la réception, intégré au SI achat existant.`,
    results: [{ v: '-14 %', l: 'de coûts achats' }, { v: '780', l: 'fournisseurs connectés' }],
    tech: ['Angular', 'Spring Boot', 'PostgreSQL', 'Kafka'],
  },
  {
    sector: ['Éducation', 'SaaS'],
    title: 'Gestion de scolarité Campus One',
    desc: `Logiciel de scolarité pour école supérieure : inscriptions, emplois du temps, absences, bulletins et portail parents, avec reprise complète de l'historique de l'ancien système.`,
    results: [{ v: '4 200', l: 'étudiants gérés' }, { v: '-80 %', l: 'de ressaisies administratives' }],
    tech: ['React', 'Node.js', 'PostgreSQL', 'Keycloak'],
  },
  {
    sector: ['Médias', 'Application mobile'],
    title: 'Application de podcasts Audia',
    desc: `Application d'écoute de podcasts : téléchargement hors ligne, reprise de lecture multi-appareils, chapitrage automatique et recommandations basées sur les écoutes réelles.`,
    results: [{ v: '95 k', l: 'auditeurs mensuels' }, { v: '+52 %', l: 'de temps d’écoute' }],
    tech: ['Swift', 'Kotlin', 'Go', 'PostgreSQL'],
  },
  {
    sector: ['Assurance', 'IA'],
    title: `Instruction de sinistres Claima`,
    desc: `Assistance à l'instruction des sinistres habitation : extraction des pièces du dossier, contrôle de cohérence avec les garanties du contrat et note de synthèse pour le gestionnaire.`,
    results: [{ v: '-36 %', l: `de délai d'indemnisation` }, { v: '58 k', l: 'sinistres instruits' }],
    tech: ['Python', 'Claude API', 'FastAPI', 'PostgreSQL'],
  },
  {
    sector: ['BTP', 'SaaS'],
    title: 'Chiffrage de devis Devizio',
    desc: `Outil de chiffrage pour artisans : bibliothèque d'ouvrages, calcul des marges, devis et factures conformes à la réglementation, relances automatiques des impayés.`,
    results: [{ v: '+29 %', l: 'de devis signés' }, { v: '3 100', l: 'artisans utilisateurs' }],
    tech: ['Vue.js', 'Laravel', 'MySQL', 'Stripe'],
  },
  {
    sector: ['Logistique', 'IoT'],
    title: 'Suivi de chaîne du froid Frigolink',
    desc: `Suivi de la chaîne du froid en transport : sondes connectées, alerte immédiate en cas de rupture de température et attestation de conformité générée à la livraison.`,
    results: [{ v: '-91 %', l: 'de ruptures de froid' }, { v: '540', l: 'remorques équipées' }],
    tech: ['Go', 'MQTT', 'TimescaleDB', 'React'],
  },
  {
    sector: ['Sport', 'IA'],
    title: 'Analyse vidéo de match Playmetrics',
    desc: `Analyse automatique de vidéos de match : détection des joueurs, statistiques de possession et de course, génération des séquences clés pour la préparation des entraînements.`,
    results: [{ v: '-85 %', l: 'temps de dépouillement vidéo' }, { v: '1 400', l: 'matchs analysés' }],
    tech: ['Python', 'PyTorch', 'FFmpeg', 'FastAPI'],
  },
  {
    sector: ['Associatif', 'SaaS'],
    title: 'Gestion de bénévoles Volunteo',
    desc: `Plateforme de gestion de bénévoles : missions ouvertes, inscriptions en autonomie, feuilles de présence et attestations d'engagement, avec espace référent par antenne locale.`,
    results: [{ v: '11 k', l: 'bénévoles mobilisés' }, { v: '+46 %', l: 'de missions pourvues' }],
    tech: ['Next.js', 'NestJS', 'PostgreSQL', 'Brevo'],
  },
  {
    sector: ['Santé', 'SaaS'],
    title: `Coordination de soins à domicile Domicilio`,
    desc: `Outil de coordination pour services de soins à domicile : tournées des intervenants, transmissions ciblées entre professionnels, télégestion des passages et facturation à l'acte.`,
    results: [{ v: '2 600', l: 'patients suivis' }, { v: '-52 %', l: 'de temps administratif par intervenant' }],
    tech: ['React', 'Node.js', 'PostgreSQL', 'HDS'],
  },
];

const RESET = process.argv.includes('--reset');
// Marqueur posé dans le JSON : permet un --reset ciblé sans toucher aux projets
// saisis à la main depuis /admin.
const SEED_TAG = 'seed-portfolio-v1';

try {
  if (PROJECTS.length !== 50) {
    console.error(`Attendu 50 projets, trouvé ${PROJECTS.length}. Abandon.`);
    process.exit(1);
  }

  if (RESET) {
    const { rowCount } = await query(
      `DELETE FROM content WHERE type = 'portfolio' AND data->>'$.seed' = $1`,
      [SEED_TAG],
    );
    console.log(`--reset : ${rowCount} projet(s) seedé(s) supprimé(s).`);
  }

  const { rows: existing } = await query(
    `SELECT data->>'$.title' AS title FROM content WHERE type = 'portfolio'`,
  );
  const known = new Set(existing.map((r) => (r.title || '').trim()));

  let inserted = 0;
  for (const p of PROJECTS) {
    if (known.has(p.title)) continue;
    const data = { ...p, image: '', featured: false, seed: SEED_TAG };
    await query(
      'INSERT INTO content (id, type, data, views) VALUES ($1, $2, $3, $4)',
      [randomUUID(), 'portfolio', JSON.stringify(data), Math.floor(Math.random() * 40) + 10],
    );
    inserted += 1;
  }

  console.log(`${inserted} projet(s) inséré(s), ${PROJECTS.length - inserted} déjà présent(s).`);
} catch (err) {
  console.error('Seed portfolio failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
