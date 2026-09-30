// Couleurs du back-office réglables par chacun dans Paramètres (CC-353).
//
// Chaque jeton est une variable CSS de globals.css (`--color-<clé>`), que
// Tailwind lit à l'exécution (`@theme inline`) : la redéfinir sur `:root`
// suffit à recolorer tout l'écran, sans rien recompiler. Les couleurs d'état
// (alerte, erreur, information) n'y sont pas : leur sens doit rester le même
// pour toute l'équipe. La liste des clés est répétée côté API, qui la valide.

export type ThemeKey = "bg" | "panel" | "panel-2" | "border" | "text" | "muted" | "mint";
export type ThemeColors = Partial<Record<ThemeKey, string>>;

export const THEME_TOKENS: { key: ThemeKey; label: string; hint: string; default: string }[] = [
  { key: "mint", label: "Accent", hint: "boutons, liens, menu actif", default: "#2bf08a" },
  { key: "bg", label: "Fond", hint: "arrière-plan de la page", default: "#0b111c" },
  { key: "panel", label: "Panneaux", hint: "cartes et bandeau du haut", default: "#111a2b" },
  { key: "panel-2", label: "Panneaux secondaires", hint: "menu latéral, champs, cartes imbriquées", default: "#0f1826" },
  { key: "border", label: "Bordures", hint: "contours et séparateurs", default: "#22304a" },
  { key: "text", label: "Texte", hint: "texte principal", default: "#e7edf5" },
  { key: "muted", label: "Texte secondaire", hint: "libellés, notes, texte discret", default: "#8494ac" },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

// La règle injectée dans la page. Chaque valeur est revalidée ici même si
// l'API l'a déjà fait : c'est du texte qui finit dans une feuille de style.
export function themeCss(colors: ThemeColors | null): string | null {
  if (!colors) return null;
  const declarations = THEME_TOKENS.filter((t) => isHexColor(colors[t.key])).map(
    (t) => `--color-${t.key}:${colors[t.key]};`,
  );
  return declarations.length ? `:root{${declarations.join("")}}` : null;
}
