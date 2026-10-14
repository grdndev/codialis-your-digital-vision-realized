import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ABSENCE_MODE_LABEL, ABSENCE_COPY, absenceRules } from "@/lib/absence";
import { ROLE_LABEL } from "@/lib/nav";
import type { AbsenceMode, SessionUser } from "@/lib/types";
import { daysFromNow, fmtDate, fmtDateTime } from "@/lib/format";
import { ImageField } from "../site/image-field";
import { ChangePasswordForm } from "./change-form";
import { ApiTokenForm } from "./api-token-form";
import { ScheduleForm } from "./schedule-form";
import { ThemeForm } from "./theme-form";
import type { ThemeColors } from "@/lib/theme";
import type { ScheduleSettings } from "./schedule-form";
import {
  updateProfileAction,
  setAbsenceModeAction,
  setAbsenceMessageAction,
  toggleAbsenceEnabledAction,
  revokeApiTokenAction,
} from "./actions";

const MODES: AbsenceMode[] = ["OUVERT", "HORAIRES", "CONGES"];

type MeResponse = {
  user: SessionUser;
  theme: ThemeColors | null;
  settings: {
    jobTitle: string | null;
    photo: string | null;
    absence: {
      mode: AbsenceMode;
      enabled: boolean;
      messageConges: string | null;
      messageHoraires: string | null;
    } | null;
    schedule: ScheduleSettings | null;
  };
  apiTokens: ApiToken[];
  apiUrl: string;
};

type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  readOnly: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export default async function ParametresPage() {
  const user = await requireUser();
  const { settings, theme, apiTokens, apiUrl } = await apiGet<MeResponse>("/api/admin/me?tokens=1");

  // La réponse d'absence ne concerne que les comptes qui suivent des clients.
  const hasAbsence = user.role === "PM" || user.role === "DIR";
  const mode = settings.absence?.mode ?? "OUVERT";
  const enabled = settings.absence?.enabled ?? false;
  const copy = ABSENCE_COPY[mode];
  // Le message rédigé prend le pas sur celui de l'agence ; vide, c'est ce
  // dernier qui part, et le champ le montre pour qu'on sache ce qu'on modifie.
  const customMessage =
    mode === "CONGES"
      ? settings.absence?.messageConges
      : mode === "HORAIRES"
        ? settings.absence?.messageHoraires
        : null;

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
        <form action={updateProfileAction} className="mt-4 flex max-w-sm flex-col gap-4">
          <ImageField name="photo" defaultValue={settings.photo ?? ""} label="Photo" />
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
              vide, rien ne s’affiche. Sans photo, le site montre vos initiales.
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

      {settings.schedule ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Mes horaires de travail</h2>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Le temps passé est mesuré : un ticket passé à « En cours » démarre un
            chronomètre, un changement de statut l’arrête. Ces horaires le bornent — rien
            n’est compté la nuit, le week-end, les jours fériés ni pendant la pause. Et
            deux tickets menés en même temps se partagent le temps écoulé.
            {settings.schedule.isDefault ? " Horaires par défaut de l’agence, à ajuster." : ""}
            {" "}Une soirée ou un week-end travaillés se déclarent dans l’écran RH, en
            heures supplémentaires.
          </p>
          <ScheduleForm schedule={settings.schedule} />
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Couleurs de l’interface</h2>
        <p className="mt-1 max-w-xl text-xs text-muted">
          Réglage personnel : il ne change que votre écran, pas celui de vos collègues. Les
          couleurs s’appliquent en direct pendant le choix et sont gardées après
          enregistrement, y compris à la prochaine connexion.
        </p>
        <ThemeForm saved={theme} />
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

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Jetons d’API</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">
          Pour utiliser le CRM depuis un script, Claude Code ou un autre agent : tout ce que
          fait l’écran passe aussi par l’API ({apiUrl}). Un jeton agit en votre nom, avec
          exactement vos droits. Il n’est affiché qu’une fois ; révoquez-le s’il est perdu ou
          ne sert plus. Mode d’emploi : API.md, à la racine du dépôt.
        </p>
        <div className="mt-4">
          <ApiTokenForm apiUrl={apiUrl} />
        </div>
        {apiTokens.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Nom</th>
                  <th className="pb-2 font-medium">Jeton</th>
                  <th className="pb-2 font-medium">Accès</th>
                  <th className="pb-2 font-medium">Dernière utilisation</th>
                  <th className="pb-2 font-medium">Expiration</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {apiTokens.map((t) => {
                  const expired = t.expiresAt !== null && daysFromNow(t.expiresAt) <= 0;
                  return (
                    <tr key={t.id} className="border-t border-border" data-testid="api-token-row">
                      <td className="py-2 pr-3 text-text">
                        {t.name}
                        <span className="block text-xs text-muted">créé le {fmtDate(t.createdAt)}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">{t.prefix}…</td>
                      <td className="py-2 pr-3 text-muted">{t.readOnly ? "Lecture seule" : "Lecture et écriture"}</td>
                      <td className="py-2 pr-3 text-muted">{fmtDateTime(t.lastUsedAt) ?? "jamais"}</td>
                      <td className={`py-2 pr-3 ${expired ? "text-red" : "text-muted"}`}>
                        {t.expiresAt ? `${expired ? "expiré le" : "le"} ${fmtDate(t.expiresAt)}` : "jamais"}
                      </td>
                      <td className="py-2 text-right">
                        <form action={revokeApiTokenAction.bind(null, t.id)}>
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-red/40 hover:text-red"
                          >
                            Révoquer
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
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
              {mode === "OUVERT" ? (
                <p className="mt-1.5 text-sm text-text">{copy.body}</p>
              ) : (
                <form action={setAbsenceMessageAction} className="mt-1.5 flex flex-col gap-2">
                  <input type="hidden" name="mode" value={mode} />
                  <textarea
                    name="message"
                    rows={5}
                    defaultValue={customMessage ?? copy.body}
                    className="input min-h-[120px] resize-y text-sm"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">
                      {customMessage
                        ? "Message personnalisé. Videz le champ pour revenir à celui de l’agence."
                        : "Texte par défaut de l’agence. Modifiez-le pour envoyer le vôtre."}
                    </p>
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg transition hover:brightness-110"
                    >
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}
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
