import type { AbsenceMode } from "@/lib/types";

export const ABSENCE_MODE_LABEL: Record<AbsenceMode, string> = {
  OUVERT: "Disponible",
  HORAIRES: "Hors horaires",
  CONGES: "Congés",
};

export const ABSENCE_COPY: Record<AbsenceMode, { title: string; meta: string; body: string }> = {
  CONGES: {
    title: "Absence en cours",
    meta: "congés · plusieurs clients concernés",
    body: "Bonjour, je suis en congés et je vous réponds dès mon retour. Si votre demande bloque l’utilisation de la plateforme, elle est transmise à votre suppléant, qui prend le relais sur les urgences.",
  },
  HORAIRES: {
    title: "Hors horaires de travail",
    meta: "réponse automatique le soir, le week-end et les jours fériés",
    body: "Bonjour, votre message est bien reçu. Nos horaires sont de 9 h à 18 h du lundi au vendredi : je le traite dès demain matin à la première heure. Si la plateforme est totalement inutilisable, signalez-le comme bug bloquant depuis le portail, l’astreinte est alertée immédiatement.",
  },
  OUVERT: {
    title: "Aucune absence",
    meta: "horaires ouvrés · réponse en général sous 2 h",
    body: "Aucune réponse automatique n’est envoyée : votre cheffe de projet répond elle-même pendant les horaires ouvrés.",
  },
};

export function absenceRules(mode: AbsenceMode): { label: string; detail: string; ok: boolean }[] {
  return [
    {
      label: "Réponse automatique aux signalements du portail",
      detail: mode === "HORAIRES" ? "Envoyée dans les deux minutes, une seule fois par client et par soirée." : "Envoyée dans les deux minutes, une seule fois par client et par absence.",
      ok: mode !== "OUVERT",
    },
    {
      label: mode === "HORAIRES" ? "Escalade des bloquants vers l’astreinte" : "Escalade des signalements bloquants vers le suppléant",
      detail: "Un bug qualifié bloquant lui est assigné et notifié immédiatement.",
      ok: mode !== "OUVERT",
    },
    mode === "OUVERT"
      ? { label: "Relances commerciales actives", detail: "Les relances partent normalement, aux horaires habituels.", ok: false }
      : mode === "HORAIRES"
        ? { label: "Relances commerciales décalées au matin", detail: "Aucun envoi entre 18 h et 9 h : les relances partent à la reprise.", ok: true }
        : { label: "Relances commerciales suspendues", detail: "Les relances prévues repartiront à votre retour.", ok: true },
    { label: "Validation des devis et avenants", detail: "Reste sur vous : aucun envoi automatique, les demandes s’empilent dans À traiter.", ok: false },
  ];
}
