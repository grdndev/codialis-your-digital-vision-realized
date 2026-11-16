"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { foldText } from "@/lib/format";

export type ExistingClient = { id: string; name: string; projects: { id: string; name: string }[] };

// Ni casse, ni accents, ni espaces, ni ponctuation : « Top-Formation »,
// « top formation » et « TopFormation » se reconnaissent.
function compact(value: string) {
  return foldText(value).replace(/[^a-z0-9]/g, "");
}

// En deçà, un nom tapé « ressemble » à trop de clients pour que la liste aide.
const MIN_LENGTH = 3;

// Les clients déjà enregistrés qui ressemblent au nom tapé : l'un contient
// l'autre (« NCD » et « NCD Garage »), ou ils sont égaux une fois réduits.
// L'égalité stricte est déjà refusée par l'API (`Client.name` est unique), mais
// pas « Top-formation » face à « Top formation ».
function lookalikes(typed: string, clients: ExistingClient[]) {
  const t = compact(typed);
  if (!t) return [];
  return clients.filter((c) => {
    const n = compact(c.name);
    if (!n) return false;
    if (n === t) return true;
    return (t.length >= MIN_LENGTH && n.includes(t)) || (n.length >= MIN_LENGTH && t.includes(n));
  });
}

// Nom d'un nouveau client, avec la liste des clients existants qui lui
// ressemblent (CC-377) : on voit le doublon avant de le créer. Un avertissement
// seulement, la création reste possible (deux homonymes peuvent exister).
export function ClientNameField({ clients }: { clients: ExistingClient[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  // Le formulaire se vide par un `reset` après une création réussie, sans
  // évènement `change` (TRAP-030) : la liste doit se vider avec lui.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setValue("");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const matches = lookalikes(value, clients);
  const exact = matches.find((c) => compact(c.name) === compact(value));

  return (
    <>
      <input
        ref={inputRef}
        name="name"
        required
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
        className="input"
      />
      <div aria-live="polite" className="empty:hidden">
        {matches.length > 0 ? (
          <div className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs">
            <p className="font-medium text-amber">
              {exact ? `« ${exact.name} » existe déjà.` : "Clients déjà enregistrés qui ressemblent :"}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {(exact ? [exact] : matches).map((c) => (
                <li key={c.id} className="text-muted">
                  <span className="font-medium text-text">{c.name}</span>
                  {" · "}
                  {c.projects.length === 0
                    ? "aucun projet"
                    : c.projects.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 ? ", " : ""}
                          <Link href={`/projects/${p.id}`} className="underline hover:text-text">
                            {p.name}
                          </Link>
                        </span>
                      ))}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}
