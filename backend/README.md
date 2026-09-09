# backend — API Codialis

**Cette application n'est qu'une API.** Elle n'a plus aucune page : la couche
visuelle a été déplacée dans `../frontend-admin`. Next.js 16 en route handlers
uniquement, Prisma/MySQL, et l'accès à la base est ici et nulle part ailleurs.

Deux surfaces, deux publics :

| Surface | Consommateur | Authentification |
|---|---|---|
| `/api/{content,settings,accounts/team,newsletter,contact,health}` | `../frontend-public` — le site vitrine statique | aucune (routes publiques) + CORS |
| `/api/auth/login` et `/api/admin/**` | `../frontend-admin` — le back-office | `Authorization: Bearer <JWT>` |

Le modèle de données, les règles métier et l'historique des décisions produit
documentés plus bas vivent ici : ce sont eux que l'API expose. Les écrans qui
les affichent sont décrits dans `../frontend-admin/README.md`.

## Setup

Requires a MySQL/MariaDB 10.6+ server — local, Docker, or hosted (PlanetScale, Railway, OVH, RDS…).

```bash
npm install
cp .env.example .env   # then set DATABASE_URL to your MySQL connection string
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

`DATABASE_URL` format: `mysql://user:password@host:3306/dbname`

L'API écoute sur http://localhost:3001 (`npx next dev -p 3001`). Il n'y a rien à
ouvrir dans un navigateur : `GET /api/health` répond `{"ok":true}`. Pour la pile
complète (base + API + les deux frontends), voir `../compose.local.yml`.

### Database: SQLite → MySQL

This app started on SQLite (fastest to iterate on) and was moved to MySQL — `prisma/schema.prisma`'s datasource is now `provider = "mysql"`. Two things came with that switch, worth knowing if you're picking this up:

- **`@db.Text` on 23 fields** — message/comment bodies, descriptions, the AI-drafted text, and a couple of serialized-JSON columns (`CdcDocument.sections`, `CustomCategoryRow.data`) are marked `@db.Text` rather than left as plain `String`. Prisma maps `String` to `VARCHAR(191)` on MySQL by default, which is fine for names/emails/refs but silently too small for anything closer to free text — these were the fields realistically likely to exceed that.
- **The migration history was regenerated for MySQL, not converted.** The old SQLite migrations (`prisma/migrations/`) contained SQLite-dialect SQL and can't run against MySQL, so that folder was deleted and replaced with a single fresh `..._init` migration generated offline (`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`) — real, validated SQL (50 tables, 61 foreign keys) that's never actually been applied to a live database, since this development sandbox has no outbound access to install or reach a MySQL server (its network policy blocks the Ubuntu package repos and PPAs needed to install one locally, and likely raw non-HTTP(S) TCP like MySQL's port 3306 too). It reads correctly and matches the schema. ~~"Run it once for real" is the one verification step still outstanding.~~ **Done** — both migrations have since been applied with `prisma migrate deploy` against a real MariaDB 10.6 server, on an empty database and on one already carrying the old Express backend's tables (see "Site vitrine" below).

## Demo accounts

Password for all: `codialis2026`

| Email | Role | Notes |
| --- | --- | --- |
| claire@codialis.fr | Dirigeante | full access + Pilotage, À traiter |
| marion@codialis.fr | Cheffe de projet | full access minus Pilotage/À traiter |
| lea@codialis.fr | Développeuse | assigned: Aiva, Top Formation, Tapix |
| karim@codialis.fr | Développeur | assigned: Aiva, Top Formation, NCD, Tapix, Oxy |
| sophie@topformation.fr | Client (Top Formation) | full portal data: devis, CDC sections, rendez-vous |
| marc@ncd.fr | Client (NCD) | portal with empty states for devis/CDC/rendez-vous |
| nadia@tapix.fr | Client (Tapix) | portal with empty states for devis/CDC/rendez-vous |

## Stack notes

- **Auth**: custom credentials + JWT signé (`src/lib/auth.ts`), **sans cookie** — le jeton est renvoyé dans le corps de `POST /api/auth/login` et vérifié ensuite dans l'en-tête `Authorization: Bearer`. Pas NextAuth — v5 is still beta and this app targets bleeding-edge Next.js 16, so a minimal `jose`-based session was safer than chasing compatibility.
- **Data**: Prisma + SQLite (`prisma/schema.prisma`, `prisma/seed.ts`). Seed data is ported directly from the prototype's data constants (`ALL_PROJECTS`, `PROJECT_EPICS`, `DEVQ`, `TRIAGE`, `PIPE`, `THREADS`, `WEEK_LOG`, `CASH_IN`, `TEAM_PROFIT`, invoices, resources, automations, `QUOTE`, `SPEC_DOC`, etc.).
- **Routing**: route handlers only (`src/app/api/**`). ~~Two route groups `(app)`/`(client)`, gated by `src/proxy.ts`.~~ Les écrans, les route groups et le proxy vivent désormais dans `../frontend-admin`.
- **Mutations**: ~~Server Actions, no separate REST/API layer.~~ Chaque écran a une route `POST /api/admin/<écran>` qui distribue sur un champ `action`, validé par une union discriminée zod. Les Server Actions existent toujours côté frontend-admin, mais ne font plus que traduire un `FormData` en appel HTTP — voir « API admin » ci-dessous.
- **AI drafting**: live on both screens that show AI-drafted text, and opt-in — `src/lib/gemini.ts` calls the Google Gemini API (`gemini-3.6-flash`, free tier) with real context to generate each draft, but only when someone clicks "Générer avec l'IA (Gemini)"; the page shows the deterministic template from `src/lib/ai-draft.ts` by default and never calls out on its own page load. This is deliberate: Gemini's free tier caps out at **20 requests/day per project** (Google's `GenerateRequestsPerDayPerProjectPerModel-FreeTier` quota — a 429 past that, handled the same as any other failure), which an always-on call per page view/tone-switch would burn through in minutes. On "Remontées client" (Triage), the ticket's data feeds the prompt and the tone selector (Neutre/Rassurant/Ferme) is reflected in it. On Automatisations, each pending relance's `kind`/`toWho`/seed text feeds the prompt. Set `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) in `app/.env` to enable it; without a key, or if a call fails (quota included), that draft falls back to the template so the screen always renders something (a badge shows which source produced it — "Gemini" or "brouillon type"). Each call is isolated in its own `<Suspense>` boundary (`AiDraftCard` in `triage/page.tsx`, `DraftText` in `automations/page.tsx`) so the rest of the page renders immediately and doesn't wait on the AI response. To raise the quota, enable billing on the Google AI Studio project (`aistudio.google.com`) — this app doesn't need any code change for that, just the account-level upgrade.
- **Calendly**: real — the client portal's "Rendez-vous" screen embeds the agency's actual Calendly scheduling widget (`src/components/calendly-embed.tsx`), configured via `NEXT_PUBLIC_CALENDLY_URL` in `.env`. Clients book real slots on the real calendar. Since no Calendly API token was provided, bookings aren't read back into the app's own database (that needs a Personal Access Token + webhook) — the "Prochain rendez-vous" agenda block still comes from the `Rdv` model, seeded/updated separately.

## What's simplified vs. the prototype

- No file upload storage — attachments are metadata rows (filename + note), not real files.
- Task/ticket acceptance criteria exist in the schema but are only populated for newly-created tickets (matches the prototype, which only fleshed out 3 example tasks).
- `TeamProfitSnapshot` and `CashForecastItem` (Pilotage) are periodic snapshots seeded once for "Août 2026" rather than derived live from `TimeEntry` history — recomputing them from real time-tracking data over a full month is a natural next step once enough `TimeEntry` rows accumulate.
- Client concentration and prospection conversion stats on Pilotage *are* computed live from `Project`/`Deal` data.
- ~~`Project.hoursSpent/progressPct`, `Task.spentHours`, `Ticket.spentHours`, and `MaintenanceContract.usedHoursThisMonth` didn't move when time was logged.~~ **Fixed** — see below.

### Data audit — what's live vs. static vs. hardcoded

Every stat shown across the 20 screens falls into one of: computed live from a real query, read from a seeded-but-static DB row (honest, just not recalculated — the two cases above), or user-entered through a real form. An audit found **6 numbers that were literal values typed into a component's JSX** rather than any of those — i.e. decorative, not backed by data at all. All six are now fixed:

| Screen | Was | Now |
|---|---|---|
| Automatisations | `"34"` relances envoyées (fabricated) | live count of `AutomationDraft` with `status: "SENT"` (starts at 0, grows as relances are actually sent) |
| Automatisations | `"−11 j"` délai de paiement (fabricated) | live average of `paidAt − dueAt` across paid invoices with both dates set |
| Automatisations | `"6 h"` temps économisé (fabricated, no data source) | live count of `AutomationRule` with `mode: "AUTO"` — a real, meaningful number in the same spot |
| Finance | `"Août 2026"` literal string | `currentPeriodLabel()` in `src/lib/format.ts`, derived from the real current date |
| CRM | `QUARTER_TARGET = 130000` constant in code | `CompanySetting.quarterlyTargetEUR`, a real DB row editable from the page ("Modifier l'objectif") |
| Pilotage | `MONTHLY_CHARGES = 21400` constant in code | `CompanySetting.monthlyChargesEUR`, editable from the page ("Modifier les charges mensuelles") |

The CRM/Pilotage fix follows the same "auto-generated or entered by hand" rule the rest of the app follows: a quarterly target or a fixed monthly overhead is a legitimate business parameter, not something derivable from other data — so it belongs in the database as something a director can edit, not frozen in the source code.

### Hour counters now actually move when time is logged

`Project.hoursSpent`, `Task.spentHours`, `Ticket.spentHours`, and `MaintenanceContract.usedHoursThisMonth` were real DB columns but nothing recomputed them — logging time on `/time` never touched them, so they were effectively frozen at their seeded values. Fixed by making `addTimeEntryAction` (`src/app/(app)/time/actions.ts`) a transaction that, on every new `TimeEntry`:

- increments `Project.hoursSpent` by the logged hours, and bumps `lastActivityAt` to now;
- if the entry is linked to a task or ticket (new "Rattaché à" field on the `/time` form — the linked task/ticket also determines the project, overriding whatever was separately picked in the project dropdown, so the two can't disagree), increments that `Task.spentHours`/`Ticket.spentHours`;
- if the project has an active `MaintenanceContract` and the entry's date falls in the current calendar month, increments `usedHoursThisMonth`. There's no automated monthly reset (that needs a scheduled job — out of scope here), so `usedHoursThisMonth` keeps accumulating past month-end until someone resets it by hand.

`Project.progressPct` isn't hours-based — it turned out (checking the seed data) to represent task-completion ratio, not a spend ratio, and closed projects are pinned at 100% regardless of hours. So instead of an increment, `src/app/(app)/projects/actions.ts` recomputes it (`done tasks / total tasks` across the project's epics, rounded) every time a task is created or its status changes, and writes the result back to `Project.progressPct`. Projects with no tasks modeled at this granularity keep their seeded value rather than dropping to a false 0%.

Verified end-to-end: logging 2h against an Aiva task moved that task's "Passé" from 0h→2h, Aiva's `hoursSpent` from 214h→216h on Dashboard/Projets/Finance simultaneously, and completing that task recomputed Aiva's live progress (which turned out to genuinely differ from the old frozen estimate — 68%→59% — since the old number was never actually derived from task completion in the first place). Logging time against a maintenance contract's project moved "Heures du mois" from 3h/4h to 4h/4h.

### Internal tasks (outside any project)

A director can now assign a task directly to a project manager that isn't tied to any client project — training, admin work, anything non-billable. New `InternalTask` model (`assigneeId`/`assignerId`/`title`/`description`/`dueAt`/`status`, reusing the `TaskStatus` enum). On `/dashboard`:

- everyone sees a "Mes tâches internes" card listing what's been assigned to them, with a button that advances it through the same À faire → En cours → En revue → Terminé flow as project tasks;
- a director additionally sees "Tâches assignées" (what they've handed out, and its status) and a "+ Assigner une tâche" form (pick a PM, title, optional detail/due date) — `assignInternalTaskAction`/`advanceInternalTaskAction` in `src/app/(app)/dashboard/actions.ts`.

Scoped to PM as the assignable role for now (Dashboard itself is DIR/PM-only — DEV has no route that would show it); broadening to DEV would need picking a page they do have.

### CSV import for prospects

On `/crm`, "+ Importer un CSV" (next to "+ Nouveau prospect") bulk-creates deals from a CSV file — `importDealsCsvAction` in `src/app/(app)/crm/actions.ts`. Expected header (order-independent): `nom` (required), `montant` (k€, matching the manual-entry form's convention), `note`, `email`, `telephone`, `source`. Every imported row lands in the Contact stage exactly like a deal created by hand (10% probability, "Premier appel à planifier"). Rows missing `nom` are skipped, not aborted — the page then shows how many were imported vs. skipped; a CSV with no `nom` column at all is rejected outright with an error banner instead of silently importing garbage. Hand-rolled a small quoted-CSV-field parser (`parseCsvLine`) rather than pulling in a dependency, since the only tricky case is a comma inside a quoted field (e.g. a note like `"Site vitrine, avec e-commerce"`) — verified that survives intact rather than getting split.

### Fiche projet

A third tab ("Fiche", next to Liste/Kanban) on `/projects/[id]` gives a one-screen project synthesis:

- **Client** — contact name/email/phone, editable in place (`Client.contactEmail`/`contactPhone` are new columns — the model previously had no way to record either). `updateClientContactAction`.
- **Contexte du projet** — phase, opened date, deadline, amount sold, and an editable description (`updateProjectDescriptionAction`).
- **Accès techniques** — a read-only summary of the project's `ApiCredential` rows (already managed on `/resources`; this just surfaces them here so the fiche is a real "everything about this project" page rather than a 6th place to maintain the same data) with a link across to manage them.
- **Questions posées au client** — new `ClientQuestion` model, directly answering "did we already ask the client about the deadline?": each question tracks À demander → Demandé → Répondu, with the client's actual answer recorded once given. `addClientQuestionAction`/`markQuestionAskedAction`/`answerClientQuestionAction`.

### Objectif mensuel & pistes de rattrapage (Pilotage)

`CompanySetting.monthlyRevenueTargetEUR` (editable, same pattern as the quarterly target and monthly charges) is compared against `Invoice` rows actually paid (`status: "PAYEE"`, `paidAt`) within the current calendar month — fully live, not a snapshot. A pace check (`monthProgressFraction()` in `src/lib/format.ts`, e.g. "11% of the month elapsed") flags when revenue is meaningfully behind where it should be by now (a 10% buffer to avoid flagging on day-to-day noise). When behind, "Pistes pour rattraper l'objectif" surfaces concrete, real levers pulled from existing data rather than a generic nudge: overdue invoices and their total (→ link to Automatisations to relance), deals sitting in Devis/Négociation and their weighted value (→ link to CRM), and prospects still stuck in Contact/Qualifié. No AI, no invented suggestions — every line is a live count/sum over data the app already has, and disappears on its own once that specific thing is resolved (verified: marking an overdue invoice paid dropped it from "2 factures, 8 400 €" to "1 facture, 2 400 €" and moved the encaissé figure in the same request).

### RH (`/rh`) — overtime, planning, business travel

New screen, visible to DEV/PM/DIR (nothing client-facing). Three self-declared trackers, each real DB rows rather than a spreadsheet nobody opens:

- **Heures supplémentaires** (`OvertimeEntry`) — declare a date + hours + optional reason; shows this month's total and each entry's status (Déclaré/Validé).
- **Mon planning** (`PlannedShift`) — a 5-cell Mon–Fri grid for the current week, each day set to Bureau/Télétravail/Chez le client/Absence via a small per-day form (`@@unique([userId, date])`, so re-saving a day upserts it rather than piling up rows).
- **Mes déplacements** (`TravelEntry`) — destination, start/end date, motif.

A director additionally sees, at the top of the page: a **"Synthèse mensuelle équipe"** table (per teammate: overtime hours declared vs. validated, travel count this month) — this is the actual answer to "at month-end, does the director know about the 2 overtime hours" — plus an **"À valider"** list combining every DECLARE-status overtime/travel entry across the team with an inline "Valider" button (`validateOvertimeAction`/`validateTravelAction`).

Caught and fixed one real bug while verifying this end-to-end: `setPlannedShiftAction` was writing dates at `T09:00:00Z` (the convention `/time` and other date-only forms in this app use) while the week grid's lookup (`currentWeekdays()`) generates midnight-UTC dates and matches by exact equality — so a saved shift silently never showed up in its own cell. Fixed by having `setPlannedShiftAction` store at midnight UTC to match; `PlannedShift` is the one date field in the app that's read back by exact-equality rather than a range, so it needs to agree with its reader on what a "day" is, unlike everything else that just needs to fall within a `[start, end)` window.

### Site vitrine (`/api/*`) — reprise de l'ancien backend Express

Le site public de Codialis (`../frontend-public`, statique, hébergé séparément) lisait ses
contenus depuis un backend Express désormais remplacé par cette application
(l'ancien code reste en lecture dans `../backend.backup`). Le frontend n'a pas
bougé d'une ligne : ce sont ses appels qui ont été réimplémentés ici en Route
Handlers, à URL, forme de réponse et code HTTP identiques.

| Route | Consommateur |
|---|---|
| `GET /api/accounts/team` | section « équipe » de `index.html` |
| `GET /api/content/{blog,portfolio,testimonials}` | `Blog.dc.html`, `Portfolio.dc.html`, `index.html` |
| `POST /api/content/:type/:id/view` | compteur de vues d'un article / d'un projet |
| `GET /api/settings/{blog_page,portfolio_page,contact_socials,home_logos}` | réglages de page + réseaux sociaux (`footer-socials.js`) |
| `POST /api/newsletter/subscribe` | formulaire du blog |
| `POST /api/contact` | formulaire de `Contact.dc.html` |
| `GET /api/health` | supervision |

Points à connaître :

- **Ces routes sont publiques, et le proxy les laisse passer.** `src/proxy.ts`
  redirigeait *tout* vers `/login` : son matcher exclut désormais `api`, sinon
  chaque appel du site depuis `codialis.com` repartait en 307 vers la page de
  connexion. Les pages privées restent gatées à l'identique.
- **CORS explicite.** Le site est sur un autre hôte, donc chaque appel est
  cross-origin. `src/lib/public-api.ts` ne renvoie l'en-tête `Allow-Origin` que
  pour les origines listées dans `CORS_ORIGINS` (défaut : `codialis.com`,
  `www.codialis.com`, `localhost:3001`), et chaque route expose un `OPTIONS` —
  les deux POST envoient `Content-Type: application/json`, donc le navigateur
  déclenche un preflight. Aucune de ces routes ne lit de cookie : pas de
  `Allow-Credentials`, l'API n'est donc pas ouverte au reste du web.
- **Les cinq tables du site gardent leurs noms snake_case d'origine**
  (`content`, `settings`, `page_views`, `newsletter_subscribers`,
  `contact_requests`), via `@@map` dans le schéma. La migration
  `20260908120000_public_site_api` les crée en `CREATE TABLE IF NOT EXISTS` :
  sur la base de production, qui les contient déjà avec tout le contenu du site,
  elle est un no-op — il n'y a aucune reprise de données à faire. Sur une base
  qui tourne déjà, `prisma migrate deploy` refusera de partir (P3005) tant que
  l'historique n'a pas été baseliné : voir <https://pris.ly/d/migrate-baseline>.
- **`Content.data` reste un blob JSON.** Le site consomme chaque item à plat
  (`{ id, views, ...data }`) : garder la forme opaque évite de figer dans le
  schéma la structure d'un article ou d'une étude de cas, qui appartient au site.
- **`User.jobTitle` / `User.photo` sont deux nouvelles colonnes facultatives.**
  Ce sont les seuls champs de l'équipe que le site affiche (intitulé sous le nom,
  photo) et le modèle n'avait pas d'équivalent — `role` est un rôle applicatif,
  pas un intitulé de poste. `GET /api/accounts/team` publie tous les comptes
  DIR/PM/DEV (direction d'abord, puis chefs de projet, puis développeurs,
  alphabétique dans chaque rôle) et ne sort que `id`/`name`/`role`/`image` —
  jamais l'email. Les comptes CLIENT sont exclus.

**Hors périmètre, et pourquoi.** L'ancien back-office vivait dans le site
vitrine (`Admin.dc.html`, servi sur `/admin`) et appelait ~35 routes RH et de
curation (`/auth/*`, `/accounts` en écriture, `/entries`, `/presence`,
`/absences`, `/recurrences`, `/feeds/*`, `/recap/*`, l'écriture du contenu et
des réglages). Elles n'ont pas été reprises : `../frontend-admin` couvre ces
besoins nativement, avec ses propres écrans et sa propre authentification.
Ce back-office a depuis été **supprimé du site vitrine** — la page, la
réécriture `/admin`, ses règles robots et la bibliothèque jsPDF qu'elle seule
chargeait. Le site vitrine ne contient donc plus aucune partie privée.

**L'édition du contenu du site a été reprise** : voir « API du site vitrine »
ci-dessous. Reste sans équivalent la **veille RSS** (`config/feeds.json`,
agrégation de flux et pré-remplissage d'un article depuis un item) — un article
se rédige aujourd'hui à la main.

### API admin (`/api/admin/*`) — extraction de la couche visuelle

Les 25 écrans du back-office vivaient ici, en Server Components qui
interrogeaient Prisma en ligne (183 appels dispersés dans les pages et les
Server Actions). Ils sont désormais dans `../frontend-admin`, qui ne parle plus
que HTTP. Ce qui a bougé et ce qui n'a pas bougé :

- **Une route par écran**, avec un `GET` (l'agrégat de lecture) et un `POST`
  (les mutations). Le `POST` distribue sur un champ `action`, validé par une
  union discriminée zod : les 59 mutations d'origine tiennent dans ~20 fichiers,
  et la surface de chaque écran se lit d'un seul coup d'œil. C'est du RPC plus
  que du REST — assumé : le seul client est notre propre back-office, une
  ressource REST par entité aurait multiplié les allers-retours sans rien
  apporter.
- **Le `GET` renvoie les lignes brutes**, telles que Prisma les rend. Les
  filtres, totaux et regroupements restent calculés à l'affichage, là où ils
  sont utilisés — c'est ce qui a permis de déplacer les écrans sans les
  réécrire.
- **Les droits sont appliqués ici**, et c'est le seul endroit qui compte. Le
  `requireRole()` de frontend-admin évite d'afficher un écran interdit ; il ne
  protège rien. Deux cloisonnements vont plus loin qu'un simple contrôle de
  rôle : un développeur ne voit que les tickets et les ressources des projets
  sur lesquels il est **affecté** (y compris par URL directe, et un `?project=`
  forgé reste borné à ses affectations), et un client ne voit que le projet
  déduit de **sa** session — `src/lib/client-scope.ts`, jamais un identifiant
  transmis dans la requête.
- **L'auteur d'une écriture vient toujours de la session**, jamais du corps :
  commentaires, notes de prospect, messages, heures supplémentaires, décisions.
- **La rédaction IA est restée ici** (`/api/admin/triage/draft`,
  `/api/admin/automations/draft`) : c'est le backend qui détient la clé Gemini
  et le gabarit de repli. L'opt-in explicite `ai=1` est conservé, pour la même
  raison qu'avant — 20 requêtes/jour sur le palier gratuit.
- **Le calendrier reste au frontend** pour `/rh` et `/pilotage`, qui envoient
  leurs bornes de période en paramètres. La grille du planning relit ses
  créneaux par égalité exacte de date : un seul endroit doit décider ce qu'est
  « cette semaine », sinon un créneau disparaît de sa propre case (le README
  documente déjà un bug de ce type, corrigé une première fois côté écriture).

Le typecheck des deux applications est le garde-fou du contrat : les formes
renvoyées sont redéclarées à la main dans `../frontend-admin/src/lib/dto.ts` et
les `types.ts` par écran. **Une modification d'`enum` dans `prisma/schema.prisma`
doit être répercutée dans `../frontend-admin/src/lib/types.ts`** — le seul lien
entre les deux applications est le JSON, pas un paquet partagé.

### Attribution des références — bug corrigé

`Invoice.ref` et `Ticket.ref` étaient dérivées du **nombre** de lignes
existantes (`F-${2600 + count}`, `${initials}-${300 + count}`), ce qui suppose
une numérotation dense repartant d'un point connu. Elle ne l'est pas : les
références du seed sont creuses (F-2597, F-2601, F-2604, F-2608). Avec 4
factures en base, le calcul retombait sur `F-2604`, déjà pris — « Créer une
facture » échouait systématiquement sur la contrainte d'unicité, avec une
erreur 500 générique.

Le bug préexistait à la séparation (le code a été porté tel quel avant d'être
corrigé) ; il a été mis au jour en testant la création de bout en bout.
`src/lib/refs.ts` repart désormais du plus grand suffixe réellement attribué,
avec quelques tentatives en cas de collision entre deux créations simultanées.
Vérifié : trois factures créées d'affilée sur la base seedée donnent F-2609,
F-2610, F-2611, et trois tickets sur le même projet AV-301, AV-302, AV-303.

### API du site vitrine en écriture (`/api/admin/site/*`)

Les routes publiques ne lisent que ce qui est déjà en base. Ces trois-là
permettent de l'alimenter, depuis les écrans `/site*` de `../frontend-admin`.
Direction et chefferie de projet uniquement — un développeur reçoit 403.

| Route | Contenu |
|---|---|
| `/api/admin/site/content` | `GET ?type=` liste ; `POST` create / update / delete d'un article, projet ou témoignage |
| `/api/admin/site/settings` | `GET` les 4 blobs ; `POST` met à jour une clé |
| `/api/admin/site/inbox` | `GET` demandes de contact, abonnés, compteurs de visites ; `POST` statut / suppression |

Quatre points méritent l'attention :

- **`src/lib/site-schemas.ts` est le garde-fou.** Le `data` d'un contenu est un
  blob JSON dont la forme est dictée par le code de lecture du site public, qui
  est figé. Un champ mal nommé ne casserait pas l'API, il casserait la page
  publique — chaque type est donc validé par un schéma zod dérivé de ce que lit
  réellement `Blog.dc.html`, `Portfolio.dc.html` et `index.html`. Même principe
  pour les catégories du blog et les icônes de réseaux sociaux : une valeur hors
  liste s'afficherait sous sa clé brute, ou sans icône du tout.
- **Les réglages sont fusionnés, pas remplacés.** `portfolio_page` porte un bloc
  `featured` que la page publique lit en repli quand aucun projet n'est coché
  « à la une ». Enregistrer l'en-tête ne doit pas l'effacer : chaque écran ne
  pousse que sa section, et la route fusionne au premier niveau.
- **Un seul contenu « à la une » par type.** Cocher un projet décroche le
  précédent, sinon la page en afficherait deux.
- **`id` et `views` sont retirés du blob avant écriture.** Ce sont des colonnes ;
  un client ne doit pas pouvoir réécrire un compteur de vues.

Les initiales et la couleur d'avatar d'un témoignage sont dérivées de l'auteur
côté API, pas saisies. La couleur est conservée à l'édition : corriger une faute
ne doit pas changer la teinte de l'avatar.

**Vérifié de bout en bout** contre une base réelle, avec le site vitrine servi
par Apache et rendu dans Chrome : un article, un projet et deux témoignages
publiés depuis l'API admin apparaissent sur `/blog`, `/portfolio` et la page
d'accueil avec tous leurs champs (catégorie, durée de lecture, secteurs,
technologies, chiffres clés, initiales d'avatar) ; l'en-tête de page et les
logos clients enregistrés s'affichent ; une modification se propage ; une
suppression fait retomber la page sur le bloc `featured` des réglages. Le délai
observé entre une écriture et son effet côté visiteur est le `max-age=60` des
routes publiques, non un défaut.

### Reprise depuis l'ancien backend Express

L'ancien schéma et le nouveau cohabitent dans la même base (les tables du site
vitrine portent d'ailleurs les mêmes noms, cf. plus haut). Deux conséquences au
premier déploiement sur cette base.

**1. `prisma migrate deploy` refuse de partir (P3005).** La base n'est pas vide
— elle contient les tables de l'ancien Express — et Prisma n'y trouve aucun
historique de migration. Il faut donc appliquer le SQL, puis déclarer les
migrations comme appliquées :

```bash
for m in prisma/migrations/*/migration.sql; do mysql "$DB" < "$m"; done
npx prisma migrate resolve --applied 20260904104301_init
npx prisma migrate resolve --applied 20260908120000_public_site_api
npx prisma migrate status   # doit dire "Database schema is up to date!"
```

Les migrations suivantes passeront ensuite par `migrate deploy` normalement.
Le `CREATE TABLE IF NOT EXISTS` de la seconde migration est ce qui rend
l'opération sûre : les tables du site déjà peuplées ne sont pas touchées.

**2. Les comptes se reprennent avec leurs mots de passe.**

```bash
npx tsx prisma/import-legacy-users.ts --dry-run   # puis sans --dry-run
```

Le script lit la table `users` de l'ancien schéma et la reverse dans `User`.
Il rapproche les comptes par e-mail, donc il est rejouable sans créer de
doublon. Renseigner `LEGACY_DATABASE_URL` si l'ancienne base est ailleurs.

Les mots de passe passent tels quels : l'ancien backend hashait avec `bcrypt`
(prefixe `$2b$`), le nouveau verifie avec `bcryptjs`, qui lit `$2a$`, `$2b$` et
`$2y$`. Personne n'a a en changer. Correspondance des roles : `patron` -> `DIR`,
`chef` -> `PM`, `employe` -> `DEV`. `poste` devient `jobTitle`, donc l'intitule
affiche sous le nom sur le site vitrine est conserve.

Ne sont **pas** repris, faute d'equivalent : les soldes de conges et d'heures
(le nouveau modele RH est declaratif, sans solde) et le drapeau "changement de
mot de passe obligatoire". Un compte qui n'avait jamais confirme son e-mail
portait un hash aleatoire inutilisable et ne pourra pas se connecter : il n'y a
pas de "mot de passe oublie" dans le nouveau backend, son mot de passe doit
etre reattribue a la main.

### Veille RSS (`/api/admin/site/veille`)

Reprise de l'ancien backend. Les sources vivent dans `config/feeds.json`,
relu à chaque appel — l'éditer ne demande pas de redémarrage. Le fichier porte
aussi `maxAgeDays` (fenêtre de fraîcheur) et `denyKeywords` (bruit grand public
à exclure : bons plans, soldes, dates de sortie).

Trois choses valent d'être connues :

- **Un flux en panne n'interrompt pas les autres.** Chaque source est lue
  séparément et son échec est rapporté dans le résumé du rafraîchissement.
  Vérifié en conditions réelles : 16 des 20 flux configurés ont répondu, les 4
  autres ont échoué (XML malformé, connexion refusée, 403) et le
  rafraîchissement a tout de même importé 360 articles. Une veille qui tombe
  entière parce qu'un seul site est hors service ne sert à rien.
- **Le rafraîchissement ne réécrit jamais un article existant** (dédoublonnage
  sur `guid`) : le statut et la recatégorisation manuelle survivent. Un second
  passage ajoute 0 article.
- **L'enrichissement est différé au moment de publier.** `refreshAll` ne lit que
  le RSS ; aller chercher l'image et le corps sur la page source coûte une
  requête HTTP par article et n'a de sens qu'une fois l'article retenu. Cette
  récupération est bornée par une garde anti-SSRF : seules les URLs dont l'hôte
  appartient à un flux configuré sont suivies.

`/api/admin/site/veille/prefill` renvoie un brouillon prêt à pousser dans le
blog, champ pour champ — catégorie traduite en catégorie de blog, durée de
lecture estimée, source citée.

### E-mails transactionnels (Brevo)

`src/lib/mail.ts` porte les gabarits et l'envoi, `src/lib/tokens.ts` les jetons.
Sans `BREVO_API_KEY`, rien ne part : la création de compte est refusée (elle en
dépend) et les notifications sont simplement journalisées.

**La création de compte n'émet aucun identifiant avant que l'adresse ne soit
prouvée.** Le compte démarre avec un hash aléatoire que personne ne connaît et
`emailVerified = false` ; un lien de confirmation part par e-mail ; le mot de
passe réel n'est engendré et envoyé qu'au clic. Si l'envoi du premier e-mail
échoue, la création est annulée — un compte que personne ne peut activer n'aide
personne. Si l'envoi des identifiants échoue, rien n'est modifié et le même lien
reste utilisable.

Autres garde-fous :

- `/api/auth/forgot` répond **toujours** 200 : une réponse différente selon que
  l'adresse existe en ferait un énumérateur de comptes. Si l'envoi échoue, le
  jeton émis est consommé aussitôt, pour ne pas laisser un lien valide dont nul
  ne dispose.
- Les jetons sont **stockés en SHA-256**, à usage unique et expirants (48 h pour
  une confirmation, 1 h pour une réinitialisation). Une fuite de la base ne
  permet pas de rejouer les liens.
- Le mot de passe est validé **avant** que le jeton ne soit consommé : un mot de
  passe refusé ne brûle pas le lien.
- `/api/auth/change-password` exige le mot de passe actuel même connecté : une
  session volée ne doit pas suffire à verrouiller le compte de son propriétaire.
- La désinscription newsletter est signée par HMAC de l'adresse (pas de ligne en
  base), et comparée en temps constant.

**Vérifié de bout en bout** contre un faux serveur Brevo qui enregistre chaque
message : création de compte → e-mail de confirmation (sans mot de passe
dedans) → connexion impossible avant confirmation → confirmation → e-mail
d'identifiants → connexion avec le mot de passe engendré → lien de confirmation
inutilisable une seconde fois. Puis mot de passe oublié → e-mail →
réinitialisation → connexion → lien mort. Puis les notifications RH (demande à
la direction, verdict à l'auteur) et la newsletter à la publication d'un
article, avec son lien de désinscription fonctionnel et un jeton falsifié
refusé.

Reste non repris : le **récap mensuel en PDF** de l'ancien backend, qui
demandait une génération de PDF (jsPDF) et un planificateur.
