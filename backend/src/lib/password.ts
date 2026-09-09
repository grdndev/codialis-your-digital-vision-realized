// Règles de mot de passe, en un seul endroit : la création (mot de passe
// engendré), la réinitialisation et le changement volontaire doivent exiger la
// même chose, sinon on peut contourner la règle par un autre chemin.

const MIN_LENGTH = 8;

// Renvoie le motif du refus, ou null si le mot de passe convient.
export function validatePassword(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Mot de passe : ${MIN_LENGTH} caractères minimum`;
  if (!/[A-ZÀ-ÖØ-Ý]/.test(password)) return "Le mot de passe doit contenir au moins une majuscule";
  if (!/[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]/.test(password)) {
    return "Le mot de passe doit contenir au moins un caractère spécial";
  }
  return null;
}
