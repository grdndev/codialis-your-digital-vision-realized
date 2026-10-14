"use client";

import { useActionState, useState } from "react";
import { createApiTokenAction, type ApiTokenState } from "./actions";

const initial: ApiTokenState = {};

// Création d'un jeton d'API. Le jeton n'est montré qu'ici, juste après sa
// création, avec de quoi s'en servir aussitôt : une fois la page quittée, il
// n'existe plus que chez la personne qui l'a copié.
export function ApiTokenForm({ apiUrl }: { apiUrl: string }) {
  const [state, formAction, isPending] = useActionState(createApiTokenAction, initial);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="token-name" className="text-xs font-medium text-muted">
            Nom
          </label>
          <input
            id="token-name"
            name="name"
            maxLength={100}
            required
            placeholder="Claude Code — portable"
            className="input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="token-access" className="text-xs font-medium text-muted">
            Accès
          </label>
          <select id="token-access" name="access" defaultValue="write" className="input">
            <option value="write">Lecture et écriture</option>
            <option value="read">Lecture seule</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="token-duration" className="text-xs font-medium text-muted">
            Validité
          </label>
          <select id="token-duration" name="duration" defaultValue="90" className="input">
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
            <option value="365">1 an</option>
            <option value="jamais">Sans expiration</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Création…" : "Créer un jeton"}
        </button>
      </form>

      {state.error ? <p className="text-sm text-red">{state.error}</p> : null}
      {state.token ? <NewToken token={state.token} name={state.name ?? ""} apiUrl={apiUrl} /> : null}
    </div>
  );
}

function NewToken({ token, name, apiUrl }: { token: string; name: string; apiUrl: string }) {
  const mcp = `claude mcp add --scope user --transport http codialis ${apiUrl}/api/mcp --header "Authorization: Bearer ${token}"`;
  const curl = `curl -H "Authorization: Bearer ${token}" "${apiUrl}/api/admin/tickets?assignee=me&status=A_FAIRE,EN_COURS"`;
  return (
    <div className="rounded-lg border border-mint/40 bg-mint/10 p-4" data-testid="new-api-token">
      <p className="text-sm font-medium text-text">
        Jeton « {name} » créé. Copiez-le maintenant : il ne sera plus jamais affiché.
      </p>
      <Snippet value={token} label="Jeton" />
      <Snippet value={mcp} label="Claude Code (serveur MCP, pour tous vos dépôts)" />
      <Snippet value={curl} label="HTTP" />
    </div>
  );
}

function Snippet({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex flex-col gap-1">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-panel-2 px-2 py-1.5 font-mono text-xs text-text">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-text"
        >
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}
