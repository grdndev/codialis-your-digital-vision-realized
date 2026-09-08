"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { moveDealAction } from "./actions";
import type { DealStage } from "@/lib/types";
import { DEAL_STAGE_LABEL } from "@/lib/format";

export type BoardDeal = {
  id: string; name: string; amount: number; note: string; nextAction: string; probabilityPct: number;
  lossReason: string | null; noteCount: number;
};
export type BoardColumn = { stage: DealStage; deals: BoardDeal[] };

function fmtK(n: number) {
  const k = n / 1000;
  return (Number.isInteger(k) ? String(k) : k.toFixed(1).replace(".", ",")) + " k€";
}

export function PipelineBoard({ columns, selectedId }: { columns: BoardColumn[]; selectedId?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);

  function onDrop(stage: DealStage) {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    startTransition(async () => {
      await moveDealAction(id, stage);
      router.refresh();
    });
  }

  return (
    <div className={`grid grid-cols-6 gap-3 ${isPending ? "opacity-70" : ""}`}>
      {columns.map((col) => {
        const total = col.deals.reduce((s, d) => s + d.amount, 0);
        return (
          <div
            key={col.stage}
            onDragOver={(e) => { e.preventDefault(); setOverStage(col.stage); }}
            onDragLeave={() => setOverStage((s) => (s === col.stage ? null : s))}
            onDrop={(e) => { e.preventDefault(); onDrop(col.stage); }}
            className={`flex min-h-[200px] flex-col rounded-xl border bg-panel transition ${
              overStage === col.stage ? "border-mint/50 bg-mint/5" : "border-border"
            }`}
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-xs font-medium text-text">{DEAL_STAGE_LABEL[col.stage]}</p>
              <p className="text-[11px] text-muted">{fmtK(total)} · {col.deals.length}</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {col.deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/crm?deal=${d.id}`}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`cursor-grab rounded-lg border bg-panel-2 p-2.5 text-xs transition active:cursor-grabbing ${
                    selectedId === d.id ? "border-mint/50" : dragId === d.id ? "border-mint/70" : "border-border"
                  }`}
                >
                  <p className="font-medium text-text">{d.name}</p>
                  <p className="mt-0.5 text-muted">{fmtK(d.amount)} · {d.note}</p>
                  <p className="mt-1 text-[11px] text-muted">{d.nextAction}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
                    <span>{d.probabilityPct}%</span>
                    {d.lossReason ? <span className="rounded-full bg-red/10 px-1.5 py-0.5 text-red">{d.lossReason}</span> : null}
                    {d.noteCount > 0 ? <span>{d.noteCount} note{d.noteCount > 1 ? "s" : ""}</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
