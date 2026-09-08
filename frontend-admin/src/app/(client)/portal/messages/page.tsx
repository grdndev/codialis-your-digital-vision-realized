import { apiGet } from "@/lib/api";
import { requireClientProject } from "@/lib/client-project";
import { fmtDateTime } from "@/lib/format";
import { ABSENCE_COPY } from "@/lib/absence";
import { sendClientMessageAction } from "../actions";
import type { PortalMessagesScreen } from "../types";

export default async function PortalMessagesPage() {
  // Le périmètre projet est déduit de la session côté API.
  await requireClientProject();

  const { messages, pm, absence } = await apiGet<PortalMessagesScreen>(
    "/api/admin/client/messages",
    "/portal",
  );

  const copy = absence ? ABSENCE_COPY[absence.mode] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Échanges avec votre cheffe de projet</h1>
        <p className="mt-1 text-sm text-muted">{pm?.name ?? "Votre cheffe de projet"} · seule interlocutrice sur votre projet</p>
      </div>

      {copy && absence?.mode !== "OUVERT" ? (
        <div className="rounded-xl border border-amber/30 bg-amber/5 p-4 text-sm">
          <p className="font-medium text-amber">RÉPONSE AUTOMATIQUE — {copy.title}</p>
          <p className="mt-1 text-text">{copy.body}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-5">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.fromClient ? "items-end" : "items-start"}`}>
            <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${m.fromClient ? "bg-mint/10 text-text" : "bg-panel-2 text-text"}`}>
              {!m.fromClient ? <p className="text-xs font-medium text-mint">{m.authorLabel}</p> : null}
              <p>{m.body}</p>
            </div>
            <p className="mt-0.5 text-[10px] text-muted">{fmtDateTime(m.createdAt)}</p>
          </div>
        ))}
        {messages.length === 0 ? <p className="text-sm text-muted">Aucun message pour l’instant.</p> : null}
      </div>

      <form action={sendClientMessageAction} className="flex gap-2">
        <input
          name="body"
          required
          placeholder={copy && absence?.mode !== "OUVERT" ? `${copy.meta} — votre message sera lu à la reprise` : "Écrire un message…"}
          className="input flex-1"
        />
        <button type="submit" className="rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-bg">Envoyer</button>
      </form>
    </div>
  );
}
