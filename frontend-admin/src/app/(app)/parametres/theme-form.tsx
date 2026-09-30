"use client";

import { useEffect, useState } from "react";
import { THEME_TOKENS } from "@/lib/theme";
import type { ThemeColors, ThemeKey } from "@/lib/theme";
import { resetThemeColorsAction, saveThemeColorsAction } from "./actions";

// Couleurs de l'interface (CC-353). L'aperçu est la page elle-même : chaque
// couleur choisie est posée sur `:root` à la volée, et c'est tout le
// back-office qui change sous les yeux. Rien n'est gardé tant qu'on n'a pas
// enregistré — quitter l'écran retire l'aperçu, la feuille de style servie par
// le layout reprend la main.

function initialValues(saved: ThemeColors | null): Record<ThemeKey, string> {
  return Object.fromEntries(
    THEME_TOKENS.map((t) => [t.key, saved?.[t.key] ?? t.default]),
  ) as Record<ThemeKey, string>;
}

export function ThemeForm({ saved }: { saved: ThemeColors | null }) {
  const [values, setValues] = useState(() => initialValues(saved));

  useEffect(() => {
    const root = document.documentElement;
    for (const t of THEME_TOKENS) root.style.setProperty(`--color-${t.key}`, values[t.key]);
  }, [values]);

  useEffect(() => {
    const root = document.documentElement;
    return () => {
      for (const t of THEME_TOKENS) root.style.removeProperty(`--color-${t.key}`);
    };
  }, []);

  const changed = THEME_TOKENS.some((t) => values[t.key] !== (saved?.[t.key] ?? t.default));
  const custom = saved !== null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <form action={saveThemeColorsAction} className="flex flex-col gap-4">
        <div className="grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3">
          {THEME_TOKENS.map((t) => (
            <label key={t.key} className="flex items-center gap-3">
              <input
                type="color"
                name={t.key}
                value={values[t.key]}
                onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-panel-2 p-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm text-text">{t.label}</span>
                <span className="block truncate text-xs text-muted">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex max-w-2xl items-center gap-3 rounded-lg border border-border bg-panel-2 px-4 py-3 text-sm">
          <span className="text-text">Aperçu</span>
          <span className="text-muted">texte secondaire</span>
          <span className="rounded-full bg-mint/10 px-2 py-0.5 text-xs font-medium text-mint">pastille</span>
          <span className="ml-auto rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Bouton</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!changed}
            className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg transition hover:brightness-110 disabled:opacity-40"
          >
            Enregistrer les couleurs
          </button>
          {changed ? (
            <button
              type="button"
              onClick={() => setValues(initialValues(saved))}
              className="text-xs text-muted hover:text-text"
            >
              Annuler les changements
            </button>
          ) : null}
        </div>
      </form>

      {custom ? (
        <form action={resetThemeColorsAction}>
          <button
            type="submit"
            // Le retour aux couleurs de l'agence est immédiat : l'aperçu suit
            // sans attendre la réponse du serveur.
            onClick={() => setValues(initialValues(null))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:text-text"
          >
            Revenir aux couleurs par défaut
          </button>
        </form>
      ) : null}
    </div>
  );
}
