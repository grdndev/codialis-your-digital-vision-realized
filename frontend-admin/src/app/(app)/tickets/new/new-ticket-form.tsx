"use client";

import { useState } from "react";
import { createTicketAction } from "../actions";

type Project = { id: string; label: string; epics: { id: string; title: string }[] };

export function NewTicketForm({ projects, team }: { projects: Project[]; team: { id: string; name: string }[] }) {
  const [type, setType] = useState<"BUG" | "DEV">("BUG");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId);

  return (
    <form action={createTicketAction} className="flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-panel p-6">
      <div className="flex gap-2">
        {(["BUG", "DEV"] as const).map((t) => (
          <label
            key={t}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
              type === t ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted"
            }`}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="sr-only"
            />
            {t === "BUG" ? "Ticket de bug" : "Ticket de développement"}
          </label>
        ))}
      </div>

      <Field label="Titre">
        <input name="title" required className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
      </Field>

      <Field label={type === "BUG" ? "Description du bug" : "Description de la fonctionnalité"}>
        <textarea name="description" rows={3} className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Projet">
          <select
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Épic">
          <select name="epicId" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" disabled={!project?.epics.length}>
            <option value="">Aucun</option>
            {project?.epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {type === "BUG" ? (
          <Field label="Gravité">
            <select name="severity" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint">
              <option value="MINEUR">Mineur</option>
              <option value="MAJEUR">Majeur</option>
              <option value="BLOQUANT">Bloquant</option>
            </select>
          </Field>
        ) : (
          <Field label="Nature">
            <select name="devNature" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint">
              <option value="FRONT">Front</option>
              <option value="BACK">Back</option>
              <option value="API">API</option>
              <option value="DESIGN">Design</option>
            </select>
          </Field>
        )}
        <Field label="Estimation (h)">
          <input name="estHours" type="text" placeholder="2" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
        </Field>
      </div>

      <Field label="Assigné">
        <select name="assigneeId" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint">
          <option value="">Non assigné</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" className="mt-2 rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-bg">
        Créer le ticket
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
