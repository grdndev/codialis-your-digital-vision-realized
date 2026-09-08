import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { sendMessageAction, convertMessageToTicketAction } from "./actions";
import type { MessagesScreen, ThreadDetail } from "./types";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "direct" ? "direct" : "project";

  // Ouvrir un fil vaut accusé de lecture : le backend s'en charge dans la
  // même requête, après avoir compté les non-lus.
  const query = new URLSearchParams({ tab });
  if (sp.thread) query.set("thread", sp.thread);
  const { rows, detail, projects } = await apiGet<MessagesScreen>(`/api/admin/messages?${query}`);

  const projectThreads = rows.filter((r) => r.thread.kind !== "DIRECT").sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
  const directThreads = rows.filter((r) => r.thread.kind === "DIRECT").sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
  const list = tab === "direct" ? directThreads : projectThreads;

  const selectedRow = (sp.thread ? rows.find((r) => r.thread.id === sp.thread) : list[0]) ?? list[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Messagerie interne</h1>
        <p className="mt-1 text-sm text-muted">un fil par projet · équipe uniquement</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 flex flex-col overflow-hidden rounded-xl border border-border bg-panel">
          <div className="flex gap-1 border-b border-border p-1 text-sm">
            <Link href="/messages?tab=project" className={`flex-1 rounded-md py-1.5 text-center ${tab === "project" ? "bg-panel-2 text-text" : "text-muted"}`}>
              Projets ({projectThreads.reduce((s, r) => s + r.unread, 0)})
            </Link>
            <Link href="/messages?tab=direct" className={`flex-1 rounded-md py-1.5 text-center ${tab === "direct" ? "bg-panel-2 text-text" : "text-muted"}`}>
              Directs ({directThreads.reduce((s, r) => s + r.unread, 0)})
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-border overflow-y-auto">
            {list.length === 0 ? <p className="px-4 py-6 text-sm text-muted">Aucun fil.</p> : list.map((r) => (
              <Link
                key={r.thread.id}
                href={`/messages?tab=${tab}&thread=${r.thread.id}`}
                className={`flex flex-col gap-1 px-4 py-3 text-sm transition hover:bg-panel-2 ${selectedRow?.thread.id === r.thread.id ? "bg-panel-2" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-text">{r.thread.title}</span>
                  {r.unread > 0 ? <span className="shrink-0 rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-semibold text-bg">{r.unread}</span> : null}
                </div>
                <p className="truncate text-xs text-muted">{r.lastMessage ? r.lastMessage.body : "Pas encore de message"}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="col-span-3">
          {detail ? <ThreadDetail thread={detail} meId={user.id} projects={projects} /> : (
            <div className="flex h-full items-center justify-center rounded-xl border border-border bg-panel px-5 py-10 text-sm text-muted">Sélectionnez un fil.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function withDayMarkers<T extends { createdAt: Date }>(messages: T[]): { message: T; showDay: boolean }[] {
  let previousDay = "";
  return messages.map((m) => {
    const key = dayKey(m.createdAt);
    const showDay = key !== previousDay;
    previousDay = key;
    return { message: m, showDay };
  });
}

async function ThreadDetail({
  thread,
  meId,
  projects,
}: {
  thread: ThreadDetail;
  meId: string;
  projects: { id: string; name: string; client: { name: string } }[];
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-panel">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-text">{thread.title}</h2>
        <p className="text-xs text-muted">{thread.participants.map((p) => p.user.name).join(", ")}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {withDayMarkers(thread.messages).map(({ message: m, showDay }) => {
          const mine = m.authorId === meId;
          return (
            <div key={m.id} className="flex flex-col gap-1">
              {showDay ? <p className="my-1 text-center text-[11px] text-muted">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(m.createdAt)}</p> : null}
              <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-mint/10 text-text" : "bg-panel-2 text-text"}`}>
                  {!mine ? <p className="text-xs font-medium text-mint">{m.author.name}</p> : null}
                  <p>{m.body}</p>
                  {m.citedLabel ? <p className="mt-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">{m.citedLabel}</p> : null}
                </div>
                <p className="mt-0.5 text-[10px] text-muted">{fmtDateTime(m.createdAt)}</p>
                {!mine ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-blue">↗ Transformer en ticket</summary>
                    <form action={convertMessageToTicketAction} className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border bg-panel-2 p-2.5">
                      <input type="hidden" name="messageId" value={m.id} />
                      <input name="title" defaultValue={m.body.slice(0, 60)} className="input text-xs" />
                      <div className="flex gap-1.5">
                        <select name="type" className="input text-xs"><option value="DEV">Développement</option><option value="BUG">Bug</option></select>
                        <select name="projectId" defaultValue={thread.projectId ?? ""} className="input text-xs">
                          <option value="">Projet</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.client.name}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="rounded-lg bg-mint px-2.5 py-1 text-xs font-semibold text-bg">Créer le ticket</button>
                    </form>
                  </details>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <form action={sendMessageAction} className="flex gap-2 border-t border-border p-3">
        <input type="hidden" name="threadId" value={thread.id} />
        <input name="body" required placeholder="Écrire un message…" className="input flex-1" />
        <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">Envoyer</button>
      </form>
    </div>
  );
}
