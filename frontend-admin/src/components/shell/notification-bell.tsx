"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Popover } from "@/app/(app)/popover";
import { STATUS_BADGE_CLASS, STATUS_LABEL, fmtDate, fmtOfficeDateTime, projectLabel } from "@/lib/format";
import type { ClientMessageNotificationRow, NotificationRow } from "@/lib/dto";

// La cloche de la barre du haut (CC-366) : les tickets dont l'échéance est
// dépassée ou tombe dans la semaine. La règle vit dans l'API
// (backend/src/lib/notifications.ts) ; l'écran ne fait qu'afficher.
//
// La barre du haut reste montée d'une page à l'autre : la liste se relit donc
// à chaque changement d'adresse, et à chaque ouverture — un ticket passé En
// revue sur la page courante en sort sans attendre la navigation suivante.
//
// La chefferie et la direction y voient aussi, en tête, les messages du portail
// client restés sans réponse (CC-374) : ils mènent à l'onglet « Échanges
// client » du projet, et disparaissent dès que quelqu'un y répond.

// Le JSON transporte les dates en chaînes : elles ne sont relues qu'à l'affichage.
type Row = Omit<NotificationRow, "dueAt"> & { dueAt: string };
type MessageRow = Omit<ClientMessageNotificationRow, "since"> & { since: string };

function dueLabel(days: number): string {
  if (days < -1) return `En retard de ${-days} jours`;
  if (days === -1) return "En retard depuis hier";
  if (days === 0) return "Échéance aujourd'hui";
  if (days === 1) return "Échéance demain";
  return `Échéance dans ${days} jours`;
}

export function NotificationBell() {
  const pathname = usePathname();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const refresh = useCallback(() => {
    fetch("/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Erreur ${res.status}`))))
      .then((data: { notifications: Row[]; clientMessages?: MessageRow[] }) => {
        setRows(data.notifications);
        setMessages(data.clientMessages ?? []);
      })
      // Une cloche muette vaut mieux qu'une page en erreur : on garde la
      // dernière liste connue, elle se relira à la prochaine navigation.
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  const overdue = rows?.filter((r) => r.overdue) ?? [];
  const soon = rows?.filter((r) => !r.overdue) ?? [];
  const count = (rows?.length ?? 0) + messages.length;

  return (
    <Popover
      onOpen={refresh}
      summary={
        <>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="sr-only">Notifications</span>
          {count > 0 ? (
            <span
              className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                overdue.length ? "bg-red text-white" : "bg-amber text-bg"
              }`}
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </>
      }
      summaryClassName="relative flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-muted transition hover:text-text"
    >
      <div className="absolute right-0 z-20 mt-2 flex max-h-[70vh] w-[24rem] flex-col overflow-hidden rounded-xl border border-border bg-panel text-xs shadow-2xl">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-text">Notifications</p>
          <p className="text-muted">Échéances dépassées ou dans les 7 jours{messages.length ? ", messages client sans réponse" : ""}</p>
        </div>
        <div className="overflow-y-auto">
          {rows === null ? (
            <p className="px-4 py-6 text-center text-muted">Chargement…</p>
          ) : count === 0 ? (
            <p className="px-4 py-6 text-center text-muted">Aucune échéance à surveiller.</p>
          ) : (
            <>
              <ClientMessages rows={messages} />
              <Group title="En retard" rows={overdue} />
              <Group title="Bientôt" rows={soon} />
            </>
          )}
        </div>
      </div>
    </Popover>
  );
}

function ClientMessages({ rows }: { rows: MessageRow[] }) {
  if (!rows.length) return null;
  return (
    <section>
      <p className="bg-panel-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Messages client · {rows.length}
      </p>
      <ul>
        {rows.map((r) => (
          <li key={r.project.id} className="border-t border-border first:border-t-0">
            <Link href={`/projects/${r.project.id}?view=echanges`} className="block px-4 py-3 transition hover:bg-panel-2">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate font-medium text-text">{projectLabel(r.project.client.name, r.project.name)}</span>
                <span className="shrink-0 font-semibold text-amber">
                  {r.count > 1 ? `${r.count} messages` : "1 message"} · depuis {fmtOfficeDateTime(new Date(r.since))}
                </span>
              </span>
              <span className="mt-1 line-clamp-2 text-muted">
                <span className="text-text">{r.author}</span> : {r.excerpt}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Group({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <section>
      <p className="bg-panel-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title} · {rows.length}
      </p>
      <ul>
        {rows.map((r) => (
          <li key={r.ref} className="border-t border-border first:border-t-0">
            <Link href={`/tickets/${r.ref}`} className="block px-4 py-3 transition hover:bg-panel-2">
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-muted">{r.ref}</span>
                <span className={`font-semibold ${r.overdue ? "text-red" : "text-amber"}`}>
                  {dueLabel(r.days)} · {fmtDate(new Date(r.dueAt))}
                </span>
              </span>
              <span className="mt-1 block text-sm text-text">{r.title}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                <span>{projectLabel(r.project.client.name, r.project.name)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                {/* Pour la chefferie, le ticket est celui de quelqu'un d'autre. */}
                {r.reason === "review" ? <span>{r.assignee?.name ?? "Non assigné"}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
