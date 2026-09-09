import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ImageField } from "../site/image-field";
import {
  createAccountAction,
  updateAccountAction,
  deleteAccountAction,
  resendVerifyAction,
} from "./actions";
import { ROLE_OPTIONS, type AccountsScreen } from "./types";

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    created?: string;
    saved?: string;
    deleted?: string;
    resent?: string;
    error?: string;
  }>;
}) {
  const me = await requireRole("DIR");
  const sp = await searchParams;
  const { users, clients, balances } = await apiGet<AccountsScreen>("/api/admin/accounts");
  const editing = sp.edit ? users.find((u) => u.id === sp.edit) : undefined;
  const balanceByUser = new Map(balances.map((b) => [b.userId, b]));
  const pending = users.filter((u) => !u.emailVerified);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Comptes</h1>
        <p className="mt-1 text-sm text-muted">
          {users.length} compte{users.length > 1 ? "s" : ""}
          {pending.length > 0 ? ` · ${pending.length} en attente de confirmation` : ""}
        </p>
      </div>

      {sp.error ? <Banner tone="red">{sp.error}</Banner> : null}
      {sp.created ? (
        <Banner tone="mint">
          Compte créé. Un lien de confirmation a été envoyé — le mot de passe ne sera
          engendré et transmis qu’une fois l’adresse confirmée.
        </Banner>
      ) : null}
      {sp.saved ? <Banner tone="mint">Compte enregistré.</Banner> : null}
      {sp.deleted ? <Banner tone="amber">Compte supprimé.</Banner> : null}
      {sp.resent ? <Banner tone="mint">Lien de confirmation renvoyé.</Banner> : null}

      <div className="rounded-xl border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Tous les comptes</h2>
          {editing ? (
            <Link href="/equipe" className="text-xs text-muted hover:text-text">
              Annuler la modification
            </Link>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Intitulé (site)</th>
                <th className="px-4 py-3 font-medium">Soldes</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const b = balanceByUser.get(u.id);
                const role = ROLE_OPTIONS.find((r) => r.value === u.role);
                return (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.photo} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint/15 text-[10px] font-semibold text-mint">
                            {u.initials}
                          </span>
                        )}
                        <span className="text-text">{u.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{u.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {role?.label ?? u.role}
                      {u.client ? <span className="text-xs"> · {u.client.name}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{u.jobTitle ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {u.role === "CLIENT"
                        ? "—"
                        : b
                          ? `${b.leave.defined ? `${b.leave.available} j` : "congés non définis"} · ${b.hours.available} h`
                          : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {u.emailVerified ? (
                        u.mustChangePassword ? (
                          <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
                            doit changer son mot de passe
                          </span>
                        ) : (
                          <span className="rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-medium text-mint">
                            actif
                          </span>
                        )
                      ) : (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted">
                          en attente
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/equipe?edit=${u.id}`}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                        >
                          Modifier
                        </Link>
                        {!u.emailVerified ? (
                          <form action={resendVerifyAction.bind(null, u.id)}>
                            <button
                              type="submit"
                              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                            >
                              Renvoyer le lien
                            </button>
                          </form>
                        ) : null}
                        {/* Son propre compte ne s'efface pas depuis ici : il
                            faudrait se verrouiller dehors pour y arriver. */}
                        {u.id !== me.id ? (
                          <form action={deleteAccountAction.bind(null, u.id)}>
                            <button
                              type="submit"
                              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                            >
                              Supprimer
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">
          {editing ? `Modifier · ${editing.name}` : "Créer un compte"}
        </h2>
        {!editing ? (
          <p className="mt-1 text-xs text-muted">
            Aucun mot de passe n’est saisi ici. Le compte démarre en attente, un lien de
            confirmation part par e-mail, et le mot de passe n’est engendré et transmis
            qu’une fois l’adresse confirmée.
          </p>
        ) : null}

        <form
          key={editing?.id ?? "new"}
          action={
            editing ? updateAccountAction.bind(null, editing.id) : createAccountAction
          }
          className="mt-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom complet" hint="les initiales de l’avatar en sont déduites">
              <input name="name" required defaultValue={editing?.name ?? ""} className="input" />
            </Field>
            <Field label="E-mail">
              <input
                name="email"
                type="email"
                required
                defaultValue={editing?.email ?? ""}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Rôle">
              <select name="role" defaultValue={editing?.role ?? "DEV"} className="input">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Client rattaché" hint="obligatoire pour un compte client">
              <select name="clientId" defaultValue={editing?.clientId ?? ""} className="input">
                <option value="">Aucun</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Intitulé de poste" hint="affiché sur le site vitrine">
              <input name="jobTitle" defaultValue={editing?.jobTitle ?? ""} className="input" />
            </Field>
          </div>

          {editing ? (
            <ImageField name="photo" defaultValue={editing.photo ?? ""} label="Photo (site vitrine)" />
          ) : null}

          <div>
            <button
              type="submit"
              className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg"
            >
              {editing ? "Enregistrer" : "Créer et envoyer l’invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">
        {label}
        {hint ? <span className="ml-1 text-[11px] font-normal">— {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "mint" | "amber" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "mint"
      ? "border-mint/30 bg-mint/5 text-mint"
      : tone === "amber"
        ? "border-amber/30 bg-amber/5 text-amber"
        : "border-red/30 bg-red/5 text-red";
  return <p className={`rounded-xl border px-4 py-2.5 text-sm ${cls}`}>{children}</p>;
}
