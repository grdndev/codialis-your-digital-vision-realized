import "server-only";
import { Prisma } from "@prisma/client";

// Attribution des références lisibles (F-2604 pour une facture, AIV-233 pour un
// ticket).
//
// Ces références étaient dérivées du NOMBRE de lignes existantes
// (`F-${2600 + count}`), ce qui suppose une numérotation dense repartant d'un
// point connu. Elle ne l'est pas : les références posées par le seed sont
// creuses (F-2597, F-2601, F-2604, F-2608), et le compte retombait donc sur une
// référence déjà prise — la création échouait sur la contrainte d'unicité.
//
// On repart désormais du plus grand suffixe réellement utilisé.

// Plus grand numéro déjà attribué pour un préfixe donné, ou null si aucun.
export function maxSuffix(refs: string[], prefix: string): number | null {
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`,
  );
  let max: number | null = null;
  for (const ref of refs) {
    const match = pattern.exec(ref);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && (max === null || n > max)) max = n;
  }
  return max;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

// Deux créations simultanées peuvent calculer le même numéro : on retente avec
// un numéro recalculé plutôt que de renvoyer une erreur à l'utilisateur.
const MAX_ATTEMPTS = 5;

export async function withUniqueRef<T>(
  nextRef: () => Promise<string>,
  create: (ref: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await create(await nextRef());
    } catch (err) {
      if (attempt === MAX_ATTEMPTS || !isUniqueViolation(err)) throw err;
    }
  }
  // Inatteignable : la dernière tentative relance toujours.
  throw new Error("Attribution de référence impossible");
}
