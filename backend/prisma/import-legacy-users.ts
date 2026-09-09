import { PrismaClient } from "@prisma/client";
import type { Role } from "@prisma/client";

// Reprise des comptes de l'ancien backend Express.
//
//   npx tsx prisma/import-legacy-users.ts [--dry-run]
//
// Lit la table `users` de l'ancien schéma et la reverse dans le modèle `User`.
// Par défaut dans la même base (les deux schémas cohabitent) ; sinon renseigner
// LEGACY_DATABASE_URL pour lire ailleurs.
//
// Les mots de passe sont conservés tels quels : l'ancien backend hashait avec
// `bcrypt` (préfixe $2b$), le nouveau vérifie avec `bcryptjs`, qui lit les
// préfixes $2a$, $2b$ et $2y$. Personne n'a à changer de mot de passe.
//
// Le script est idempotent : il rapproche les comptes par e-mail, donc on peut
// le relancer sans créer de doublon.

type LegacyUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  poste: string;
  email_verified: number | boolean;
  photo: string | null;
  created_at: Date;
};

// L'ancien backend n'avait que trois rôles, tous internes. `CLIENT` n'existait
// pas : le portail client est une nouveauté, aucun compte ne peut lui échoir.
const ROLE_MAP: Record<string, Role> = {
  patron: "DIR",
  chef: "PM",
  employe: "DEV",
};

// « Marie Dupont » -> « MD », « Codialis » -> « CO ». Le nouveau modèle exige
// des initiales, l'ancien ne les stockait pas.
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const prisma = new PrismaClient();

// Base de lecture : la même par défaut, une autre si LEGACY_DATABASE_URL est
// fourni (dump restauré à côté, par exemple).
const legacyUrl = process.env.LEGACY_DATABASE_URL;
const legacy = legacyUrl
  ? new PrismaClient({ datasources: { db: { url: legacyUrl } } })
  : prisma;

async function readLegacyUsers(): Promise<LegacyUser[]> {
  try {
    return await legacy.$queryRawUnsafe<LegacyUser[]>(
      "SELECT id, name, email, password_hash, role, poste, email_verified, photo, created_at " +
        "FROM users ORDER BY created_at ASC",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Cas courant : on pointe une base neuve où l'ancien schéma n'a jamais existé.
    if (/doesn't exist|Unknown table|no such table/i.test(message)) {
      console.error(
        "Table `users` (ancien schéma) introuvable dans cette base.\n" +
          "Si l'ancienne base est ailleurs, relancer avec LEGACY_DATABASE_URL=mysql://…",
      );
      process.exit(1);
    }
    throw err;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const users = await readLegacyUsers();

  if (users.length === 0) {
    console.log("Aucun compte dans la table `users` : rien à reprendre.");
    return;
  }

  console.log(`${users.length} compte(s) trouvé(s) dans l'ancien schéma.${dryRun ? " (simulation)" : ""}`);

  let created = 0;
  let updated = 0;
  const unusable: string[] = [];
  const unknownRole: string[] = [];

  for (const u of users) {
    const role = ROLE_MAP[u.role];
    if (!role) {
      // On préfère ne rien inventer : un rôle inconnu est signalé, pas deviné.
      unknownRole.push(`${u.email} (rôle « ${u.role} »)`);
      continue;
    }

    const email = u.email.trim().toLowerCase();
    const name = u.name.trim() || email;
    const data = {
      email,
      name,
      initials: initialsOf(name),
      role,
      passwordHash: u.password_hash,
      // `poste` alimentait déjà la section équipe du site vitrine ; il devient
      // l'intitulé affiché sous le nom.
      jobTitle: u.poste?.trim() || null,
      photo: u.photo || null,
    };

    // Un compte jamais confirmé portait un hash aléatoire inutilisable :
    // l'ancien backend refusait sa connexion tant que l'e-mail n'était pas
    // validé. Le nouveau n'a pas ce garde-fou — le compte existera mais restera
    // inaccessible, faute de mot de passe connu.
    if (!u.email_verified) unusable.push(email);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (dryRun) {
      console.log(`  ${existing ? "mettrait à jour" : "créerait"}  ${email}  ${u.role} -> ${role}`);
      existing ? updated++ : created++;
      continue;
    }

    if (existing) {
      // On ne touche pas à l'identifiant d'un compte déjà présent : des lignes
      // du nouveau schéma peuvent déjà le référencer.
      await prisma.user.update({ where: { email }, data });
      updated++;
      console.log(`  mis à jour  ${email}  ${u.role} -> ${role}`);
    } else {
      // L'identifiant d'origine est conservé, pour garder la trace entre les
      // deux schémas.
      await prisma.user.create({ data: { ...data, id: u.id, createdAt: u.created_at } });
      created++;
      console.log(`  créé        ${email}  ${u.role} -> ${role}`);
    }
  }

  console.log(`\n${created} créé(s), ${updated} mis à jour.`);

  if (unknownRole.length) {
    console.log(`\nNON REPRIS — rôle inconnu (${unknownRole.length}) :`);
    unknownRole.forEach((l) => console.log(`  ${l}`));
  }

  if (unusable.length) {
    console.log(
      `\nATTENTION — ${unusable.length} compte(s) n'avaient jamais confirmé leur e-mail dans\n` +
        "l'ancien backend : leur hash est un pré-remplissage inutilisable, ils ne\n" +
        "pourront pas se connecter. Il n'y a pas de « mot de passe oublié » dans le\n" +
        "nouveau backend : leur mot de passe doit être réattribué à la main.",
    );
    unusable.forEach((e) => console.log(`  ${e}`));
  }

  console.log(
    "\nNon repris (sans équivalent dans le nouveau schéma) : soldes de congés et\n" +
      "d'heures, drapeau « changement de mot de passe obligatoire ».",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (legacy !== prisma) await legacy.$disconnect();
  });
