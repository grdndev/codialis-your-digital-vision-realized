import { Suspense } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { AUTOMATION_MODE_LABEL } from "@/lib/format";
import { ABSENCE_MODE_LABEL, ABSENCE_COPY, absenceRules } from "@/lib/absence";
import type { AbsenceMode } from "@/lib/types";
import type { AutomationsScreen, AutomationDraftText } from "./types";
import { setAbsenceModeAction, toggleAbsenceEnabledAction, toggleRuleModeAction, sendDraftAction, ignoreDraftAction } from "./actions";

const MODES: AbsenceMode[] = ["OUVERT", "HORAIRES", "CONGES"];

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ai?: string }>;
}) {
  await requireRole("PM", "DIR");
  const aiDraftId = (await searchParams).ai;

  const { absence, autoRules, drafts, signals, sentCount, ignoredCount, paidInvoices } =
    await apiGet<AutomationsScreen>("/api/admin/automations");

  const mode = absence?.mode ?? "OUVERT";
  const enabled = absence?.enabled ?? false;
  const copy = ABSENCE_COPY[mode];
  const rules = absenceRules(mode);


  const activeRuleCount = autoRules.filter((r) => r.mode === "AUTO").length;
  const avgPaymentDelayDays = paidInvoices.length
    ? Math.round(
        paidInvoices.reduce((s, inv) => s + (inv.paidAt!.getTime() - inv.dueAt!.getTime()) / 86_400_000, 0) /
          paidInvoices.length
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Automatisations &amp; IA</h1>
        <p className="mt-1 text-sm text-muted">{drafts.length} relances à valider ce matin</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Relances envoyées" value={String(sentCount)} note={`${ignoredCount} ignorée${ignoredCount > 1 ? "s" : ""}`} />
        <Kpi
          label="Délai de paiement moyen"
          value={avgPaymentDelayDays === null ? "—" : `${avgPaymentDelayDays > 0 ? "+" : ""}${avgPaymentDelayDays} j`}
          note={avgPaymentDelayDays === null ? "aucune facture payée avec échéance" : `sur ${paidInvoices.length} facture${paidInvoices.length > 1 ? "s" : ""} payée${paidInvoices.length > 1 ? "s" : ""} · ${avgPaymentDelayDays <= 0 ? "avant" : "après"} échéance`}
          color={avgPaymentDelayDays !== null && avgPaymentDelayDays <= 0 ? "text-mint" : undefined}
        />
        <Kpi label="Règles automatiques actives" value={String(activeRuleCount)} note={`sur ${autoRules.length} règle${autoRules.length > 1 ? "s" : ""} au total`} color="text-mint" />
        <Kpi label="Brouillons en attente" value={String(drafts.length)} note="aucun envoi sans validation" color="text-blue" />
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-text">Absences et réponses automatiques</h2>
            <p className="mt-1 text-xs text-muted">{copy.title} · {copy.meta}</p>
          </div>
          {absence ? (
            <form action={toggleAbsenceEnabledAction.bind(null, absence.pmId)}>
              <button
                type="submit"
                className={`rounded-full px-3 py-1 text-xs font-medium ${enabled ? "bg-amber/15 text-amber" : "bg-white/5 text-muted"}`}
              >
                {mode === "OUVERT" ? "aucune réponse à envoyer" : enabled ? "réponses activées" : "réponses désactivées"}
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          {MODES.map((m) => (
            <form key={m} action={setAbsenceModeAction}>
              <input type="hidden" name="mode" value={m} />
              <button
                type="submit"
                className={`rounded-lg border px-3 py-1.5 text-sm ${mode === m ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted hover:text-text"}`}
              >
                {ABSENCE_MODE_LABEL[m]}
              </button>
            </form>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-panel-2 p-3">
            <p className="text-xs font-medium text-muted">Message envoyé au client</p>
            <p className="mt-1.5 text-sm text-text">{copy.body}</p>
          </div>
          <div className="rounded-lg border border-border bg-panel-2 p-3">
            <p className="text-xs font-medium text-muted">Règles {mode === "CONGES" ? "pendant l’absence" : mode === "HORAIRES" ? "hors horaires" : "appliquées"}</p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {rules.map((r) => (
                <div key={r.label} className="flex items-start gap-2 text-sm">
                  <span className={r.ok ? "text-mint" : "text-muted"}>{r.ok ? "✓" : "–"}</span>
                  <div>
                    <p className="text-text">{r.label}</p>
                    <p className="text-xs text-muted">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold text-text">Règles</h2></div>
        <div className="flex flex-col divide-y divide-border">
          {autoRules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-text">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted">{r.trigger}</p>
                <p className="mt-1 text-xs text-muted">{r.channel} · dernier : {r.lastRun} · {r.stat}</p>
              </div>
              <form action={toggleRuleModeAction.bind(null, r.id)} className="shrink-0">
                <button
                  type="submit"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${r.mode === "AUTO" ? "bg-mint/10 text-mint" : "bg-blue/10 text-blue"}`}
                >
                  {AUTOMATION_MODE_LABEL[r.mode]}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold text-text">Brouillons IA</h2></div>
          <div className="flex flex-col divide-y divide-border">
            {drafts.length === 0 ? <p className="px-5 py-4 text-sm text-muted">Aucun brouillon en attente.</p> : drafts.map((dr) => (
              <div key={dr.id} className="flex flex-col gap-2 px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text">{dr.toWho}</span>
                  <span className="text-xs text-muted">{dr.kind}</span>
                </div>
                {aiDraftId === dr.id ? (
                  <Suspense fallback={<p className="text-muted animate-pulse">{dr.text}</p>}>
                    <DraftText draftId={dr.id} />
                  </Suspense>
                ) : (
                  <div>
                    <span className="mb-1 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted">brouillon type</span>
                    <p className="text-muted">{dr.text}</p>
                    <Link
                      href={`/automations?ai=${dr.id}`}
                      className="mt-1.5 inline-block rounded-lg border border-blue/30 px-2.5 py-1 text-xs font-medium text-blue hover:bg-blue/10"
                    >
                      Générer avec l’IA (Gemini)
                    </Link>
                  </div>
                )}
                <div className="flex gap-2">
                  <form action={sendDraftAction.bind(null, dr.id)}>
                    <button type="submit" className="rounded-lg bg-mint px-2.5 py-1 text-xs font-semibold text-bg">Envoyer</button>
                  </form>
                  <form action={ignoreDraftAction.bind(null, dr.id)}>
                    <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">Ignorer</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold text-text">Signaux détectés</h2></div>
          <div className="flex flex-col divide-y divide-border">
            {signals.map((s) => (
              <div key={s.id} className="px-5 py-3 text-sm">
                <p className="text-text">{s.text}</p>
                <p className={`mt-1 text-xs ${s.severity === "red" ? "text-red" : s.severity === "amber" ? "text-amber" : "text-blue"}`}>{s.meta}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">
        Un texte type est proposé par défaut ; cliquez sur « Générer avec l’IA » pour obtenir une version rédigée en
        direct par l’API Google Gemini à partir des données réelles du projet (avec repli sur le texte type si la clé
        n’est pas configurée ou si l’appel échoue).
      </p>
    </div>
  );
}

function Kpi({ label, value, note, color }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${color ?? "text-text"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

// Le prompt et l'appel Gemini sont côté backend : on ne passe que l'identifiant.
async function DraftText({ draftId }: { draftId: string }) {
  const { text, source } = await apiGet<AutomationDraftText>(
    `/api/admin/automations/draft?draftId=${draftId}`,
  );
  return (
    <div>
      <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${source === "gemini" ? "bg-blue/10 text-blue" : "bg-white/5 text-muted"}`}>
        {source === "gemini" ? "Gemini" : "brouillon type"}
      </span>
      <p className="text-muted">{text}</p>
    </div>
  );
}
