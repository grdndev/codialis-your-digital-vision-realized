import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ABSENCE_MODE_LABEL, ABSENCE_COPY, absenceRules } from "@/lib/absence";
import { ROLE_LABEL } from "@/lib/nav";
import type { AbsenceMode, SessionUser } from "@/lib/types";
import { ChangePasswordForm } from "./change-form";
import { updateProfileAction, setAbsenceModeAction, toggleAbsenceEnabledAction } from "./actions";

const MODES: AbsenceMode[] = ["OUVERT", "HORAIRES", "CONGES"];

type MeResponse = {
  user: SessionUser;
  settings: {
    jobTitle: string | null;
    absence: { mode: AbsenceMode; enabled: boolean } | null;
  };
};

export default async function ParametresPage() {
  const user = await requireUser();
  const { settings } = await apiGet<MeResponse>("/api/admin/me");

  // La réponse d'absence ne concerne que les comptes qui suivent des clients.
  const hasAbsence = user.role === "PM" || user.role === "DIR";
  const mode = settings.absence?.mode ?? "OUVERT";
  const enabled = settings.absence?.enabled ?? false;
  const copy = ABSENCE_COPY[mode];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Paramètres</h1>
        <p className="mt-1 text-sm text-muted">
          {user.email} · {ROLE_LABEL[user.role]}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Mon profil</h2>
        <p className="mt-1 text-xs text-muted">
          Le nom, l’adresse et le rôle sont tenus par la direction depuis l’écran Comptes.
        </p>
        <form action={updateProfileAction} className="mt-4 flex max-w-sm flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jobTitle" className="text-xs font-medium text-muted">
              Intitulé
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              defaultValue={settings.jobTitle ?? ""}
              placeholder="Développeuse front"
              className="input"
            />
            <p className="text-xs text-muted">
              Affiché sous votre nom dans la section « équipe » du site vitrine. Laissé
              vide, rien ne s’affiche.
            </p>
          </div>
          <button
            type="submit"
            className="self-start rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg transition hover:brightness-110"
          >
            Enregistrer
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Mon mot de passe</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
        <p className="mt-4 max-w-sm text-xs text-muted">
          Le mot de passe actuel est exigé même connecté : une session volée ne doit pas
          suffire à verrouiller le compte de son propriétaire.
        </p>
      </div>

      {hasAbsence ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text">Mes absences</h2>
              <p className="mt-1 text-xs text-muted">
                {copy.title} · {copy.meta}
              </p>
            </div>
            {settings.absence ? (
              <form action={toggleAbsenceEnabledAction}>
                <button
                  type="submit"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${enabled ? "bg-amber/15 text-amber" : "bg-white/5 text-muted"}`}
                >
                  {mode === "OUVERT"
                    ? "aucune réponse à envoyer"
                    : enabled
                      ? "réponses activées"
                      : "réponses désactivées"}
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
              <p className="text-xs font-medium text-muted">
                Règles{" "}
                {mode === "CONGES"
                  ? "pendant l’absence"
                  : mode === "HORAIRES"
                    ? "hors horaires"
                    : "appliquées"}
              </p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {absenceRules(mode).map((r) => (
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
      ) : null}
    </div>
  );
}
