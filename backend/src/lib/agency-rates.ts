import "server-only";
import { prisma } from "@/lib/prisma";
import { hoursFromPrice } from "@/lib/billing";

// Taux de l'agence (CC-357) : taux horaire et durée d'une journée, sur la
// ligne unique de paramètres d'entreprise. Sans ligne, les valeurs par défaut
// du schéma s'appliquent — 90 €/h sur 8 h, soit 720 € la journée.
export const DEFAULT_HOURLY_RATE = 90;
export const DEFAULT_WORKDAY_HOURS = 8;

export async function agencyRates(): Promise<{ hourlyRate: number; workdayHours: number }> {
  const setting = await prisma.companySetting.findFirst({
    select: { hourlyRateEUR: true, workdayHours: true },
  });
  return {
    hourlyRate: setting?.hourlyRateEUR ?? DEFAULT_HOURLY_RATE,
    workdayHours: setting?.workdayHours ?? DEFAULT_WORKDAY_HOURS,
  };
}

// Heures vendues à enregistrer quand on écrit le prix d'un projet. Elles ne
// se recalculent QUE si le prix change : un projet vendu garde ses heures
// quand le taux de l'agence évolue ensuite, et une correction sans rapport
// avec le prix ne les réécrit pas. Sans prix, ce sont les heures saisies.
export async function soldHoursFor(
  nextPrice: number | null,
  current: { soldAmount: number | null; hoursSold: number } | null,
  typedHours: number,
): Promise<number> {
  if (!nextPrice || nextPrice <= 0) return typedHours;
  if (current && current.soldAmount === nextPrice) return current.hoursSold;
  return hoursFromPrice(nextPrice, (await agencyRates()).hourlyRate);
}
