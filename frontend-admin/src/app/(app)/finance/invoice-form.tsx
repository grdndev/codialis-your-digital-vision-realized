"use client";

import { useState } from "react";
import { createInvoiceAction } from "./actions";
import type { NextMilestone } from "./types";

// Création d'une facture (CC-350). Choisir un projet annonce aussitôt son
// échéance suivante — « Mi-parcours (40 %) · 4 800 € » — et c'est elle qui part
// par défaut ; la facture libre reste à un clic pour un avenant. Le montant
// affiché n'est qu'un aperçu : l'API le recalcule à l'envoi.

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

function nextText(next: NextMilestone | undefined): string {
  if (!next) return "";
  if (next.status === "no-total") return "Pas de prix total renseigné : seule une facture libre est possible.";
  if (next.status === "done") return "Toutes les échéances sont facturées : seule une facture libre est possible.";
  if (next.amount <= 0) return "Plus rien à facturer sur l’échéancier : seule une facture libre est possible.";
  return `${next.label} · ${EUR.format(next.amount)}`;
}

export function InvoiceForm({
  projects,
  nextByProject,
}: {
  projects: { id: string; label: string }[];
  nextByProject: Record<string, NextMilestone>;
}) {
  const [projectId, setProjectId] = useState("");
  const [choice, setChoice] = useState<"milestone" | "free" | null>(null);
  const next = projectId ? nextByProject[projectId] : undefined;
  const milestonePossible = next?.status === "next" && next.amount > 0;
  // Sans choix explicite, l'échéance suivante l'emporte dès qu'elle existe.
  const kind = milestonePossible ? (choice ?? "milestone") : "free";

  return (
    <form action={createInvoiceAction} className="mt-2 flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        <select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="input col-span-2"
        >
          <option value="">Projet</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="col-span-2 flex items-center gap-2 text-xs text-muted">
          Échéance de paiement
          <input name="dueAt" type="date" className="input flex-1" />
        </label>
      </div>

      {projectId ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-panel-2 p-3 text-sm">
          <input type="hidden" name="kind" value={kind} />
          <label className={`flex items-center gap-2 ${milestonePossible ? "text-text" : "text-muted"}`}>
            <input
              type="radio"
              checked={kind === "milestone"}
              disabled={!milestonePossible}
              onChange={() => setChoice("milestone")}
              className="accent-mint"
            />
            Échéance suivante
            <span className={milestonePossible ? "font-medium text-mint" : "text-xs"}>{nextText(next)}</span>
          </label>
          <label className="flex items-center gap-2 text-text">
            <input type="radio" checked={kind === "free"} onChange={() => setChoice("free")} className="accent-mint" />
            Facture libre (avenant, prestation hors échéancier)
          </label>
          {kind === "free" ? (
            <div className="grid grid-cols-4 gap-2">
              <input name="label" placeholder="Libellé (ex : avenant agent IA)" className="input col-span-3" required />
              <input name="amount" placeholder="Montant €" className="input" required />
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={!projectId} className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">
        Créer la facture
      </button>
    </form>
  );
}
