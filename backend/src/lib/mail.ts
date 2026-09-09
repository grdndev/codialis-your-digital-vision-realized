import "server-only";
import { randomBytes } from "node:crypto";
import { signUnsubscribe } from "@/lib/tokens";
import type { Role } from "@prisma/client";

// E-mails transactionnels via Brevo.
// https://developers.brevo.com/reference/sendtransacemail
//
// Aucune dépendance : Node fournit `fetch`. `sendEmail` LÈVE en cas d'échec —
// c'est à l'appelant de décider. Deux comportements dans l'application :
//   - un envoi dont dépend le sens de l'action (identifiants d'un nouveau
//     compte) est attendu, et son échec annule l'action ;
//   - une notification (demande RH créée, article publié) part en
//     « best-effort » : son échec est journalisé, jamais propagé à la réponse.

// Surchargeable pour pointer un bac à sable ou un serveur de test : sans quoi
// aucun envoi ne peut être vérifié autrement qu'en écrivant à de vraies boîtes.
function brevoUrl(): string {
  return process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";
}

function senderName(): string {
  return process.env.BREVO_SENDER_NAME || "Codialis";
}

function senderEmail(): string {
  // Doit être un expéditeur validé dans le compte Brevo, sinon l'API refuse.
  return process.env.BREVO_SENDER_EMAIL || "no-reply@codialis.com";
}

// Origine du BACK-OFFICE : c'est là que mènent les liens qu'un humain ouvre
// (connexion, confirmation de compte, réinitialisation).
function adminOrigin(): string {
  return (process.env.ADMIN_URL || "https://admin.codialis.com").replace(/\/$/, "");
}

function loginUrl(): string {
  return `${adminOrigin()}/login`;
}

// Origine du SITE VITRINE, hébergé séparément : le blog, et la page de
// désinscription servie par l'API.
function siteOrigin(): string {
  return (process.env.SITE_URL || "https://codialis.com").replace(/\/$/, "");
}

function apiOrigin(): string {
  return (process.env.API_URL || "https://landingback.codialis.com").replace(/\/$/, "");
}

function unsubscribeUrl(email: string): string {
  const token = signUnsubscribe(email);
  return `${apiOrigin()}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

// Logo hébergé, facultatif. Sans lui, l'en-tête retombe sur un mot-symbole en
// HTML, qui s'affiche même quand le client bloque les images distantes.
function logoUrl(): string {
  return process.env.BREVO_LOGO_URL || "";
}

// Couleurs de la marque, en un seul endroit pour que tous les e-mails restent
// cohérents.
const BRAND = {
  navy: "#08111e",
  panel: "#0f1c2e",
  green: "#2fed7f",
  ink: "#1a2432",
  muted: "#5c6b80",
  line: "#e4e8ee",
  page: "#f4f6f8",
  card: "#ffffff",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function brandMark(): string {
  const src = logoUrl();
  if (src) {
    return `<img src="${escapeHtml(src)}" alt="Codialis" width="150" height="34"
      style="display:block;border:0;height:34px;width:auto;max-width:150px" />`;
  }
  return `<span style="font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;letter-spacing:.14em;color:#ffffff;text-transform:uppercase">CODIALIS</span><span style="display:inline-block;width:9px;height:9px;background:${BRAND.green};margin-left:4px;vertical-align:baseline"></span>`;
}

// Bouton d'action. Le repli VML garde un bouton plein sous Outlook, qui ignore
// les arrondis et les fonds CSS.
function ctaButton(label: string, url: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0">
    <tr><td align="center" bgcolor="${BRAND.green}" style="border-radius:10px">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(url)}" style="height:46px;v-text-anchor:middle;width:220px" arcsize="22%" fillcolor="${BRAND.green}" stroked="f"><w:anchorlock/><center style="color:${BRAND.navy};font-family:Arial,sans-serif;font-size:15px;font-weight:bold"><![endif]-->
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 32px;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${BRAND.navy};text-decoration:none;border-radius:10px">${escapeHtml(label)}</a>
      <!--[if mso]></center></v:roundrect><![endif]-->
    </td></tr>
  </table>`;
}

// Coquille commune. `preheader` est la ligne d'aperçu masquée que montrent les
// boîtes de réception avant l'ouverture.
function emailLayout({ preheader, bodyHtml }: { preheader: string; bodyHtml: string }): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Codialis</title>
<!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(8,17,30,.08)">
        <tr><td style="background:${BRAND.navy};padding:26px 36px">${brandMark()}</td></tr>
        <tr><td style="height:4px;background:${BRAND.green};line-height:4px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:${BRAND.card};padding:36px 36px 40px 36px;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;color:${BRAND.ink};line-height:1.6">${bodyHtml}</td></tr>
        <tr><td style="background:${BRAND.navy};padding:22px 36px;font-family:Arial,Helvetica,sans-serif">
          <p style="margin:0 0 4px 0;font-size:13px;color:#ffffff;font-weight:700;letter-spacing:.04em">Codialis</p>
          <p style="margin:0;font-size:12px;color:#8a99ad;line-height:1.5">Cet e-mail vous a été envoyé automatiquement, merci de ne pas y répondre.</p>
          <p style="margin:12px 0 0 0;font-size:11px;color:#5c6b80">© ${year} Codialis — Tous droits réservés</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function notice(text: string): string {
  return `<p style="margin:22px 0 0 0;padding:14px 16px;background:${BRAND.page};border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">${text}</p>`;
}

const ROLE_LABEL: Record<Role, string> = {
  DIR: "Direction",
  PM: "Chefferie de projet",
  DEV: "Développement",
  CLIENT: "Client",
};

// Mot de passe lisible et solide : ni O/0 ni l/1, et au moins une majuscule,
// une minuscule, un chiffre et un caractère spécial — le tirage est rejoué
// jusqu'à ce que ce soit le cas, plutôt que corrigé après coup.
export function generatePassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%*?";
  for (;;) {
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
    if (/[A-Z]/.test(out) && /[a-z]/.test(out) && /[0-9]/.test(out) && /[!@#%*?]/.test(out)) {
      return out;
    }
  }
}

// Lien de retour vers le back-office portant un jeton à usage unique.
function actionUrl(param: "verify" | "reset", token: string): string {
  return `${adminOrigin()}/${param}?token=${encodeURIComponent(token)}`;
}

// --- Envoi ------------------------------------------------------------------

type SendArgs = { email: string; name: string; subject: string; htmlContent: string };

async function sendEmail({ email, name, subject, htmlContent }: SendArgs): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY manquant : aucun e-mail ne peut partir.");

  const res = await fetch(brevoUrl(), {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: senderName(), email: senderEmail() },
      to: [{ email, name }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
  }
}

// Notifications : leur échec ne doit jamais faire échouer l'action qui les a
// déclenchées. On journalise et on continue.
export function sendInBackground(label: string, send: () => Promise<void>): void {
  send().catch((err) => {
    console.error(`E-mail « ${label} » non envoyé :`, err instanceof Error ? err.message : err);
  });
}

export function mailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

// --- Confirmation de compte -------------------------------------------------

// Aucun identifiant ici : cliquer le lien prouve que l'adresse est réelle, et
// c'est SEULEMENT après que le mot de passe est engendré et envoyé.
export async function sendVerifyEmail(args: {
  name: string;
  email: string;
  role: Role;
  token: string;
}): Promise<void> {
  const url = actionUrl("verify", args.token);
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Confirmez votre compte</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(args.name)},</h1>
    <p style="margin:0 0 8px 0;font-size:15px;color:${BRAND.ink}">Un compte <strong style="color:${BRAND.navy}">${ROLE_LABEL[args.role]}</strong> a été créé pour vous sur l'espace Codialis.</p>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Pour l'activer, confirmez que cette adresse est bien la vôtre. Vos identifiants vous seront envoyés juste après.</p>
    ${ctaButton("Confirmer mon compte", url)}
    ${notice("Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.")}`;

  await sendEmail({
    email: args.email,
    name: args.name,
    subject: "Confirmez votre compte Codialis",
    htmlContent: emailLayout({
      preheader: "Confirmez votre compte Codialis pour recevoir vos identifiants.",
      bodyHtml: body,
    }),
  });
}

export async function sendWelcomeEmail(args: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<void> {
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Bienvenue à bord</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(args.name)},</h1>
    <p style="margin:0 0 8px 0;font-size:15px;color:${BRAND.ink}">Votre compte <strong style="color:${BRAND.navy}">${ROLE_LABEL[args.role]}</strong> est prêt.</p>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Voici vos identifiants de connexion :</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.panel};border-radius:12px;margin:0 0 26px 0">
      <tr><td style="padding:22px 24px">
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a99ad">E-mail</p>
        <p style="margin:0 0 18px 0;font-family:'IBM Plex Mono',Consolas,monospace;font-size:15px;color:#ffffff;word-break:break-all">${escapeHtml(args.email)}</p>
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a99ad">Mot de passe</p>
        <p style="margin:0;font-family:'IBM Plex Mono',Consolas,monospace;font-size:18px;font-weight:700;color:${BRAND.green};word-break:break-all">${escapeHtml(args.password)}</p>
      </td></tr>
    </table>
    ${ctaButton("Se connecter", loginUrl())}
    ${notice(`<strong style="color:${BRAND.ink}">Sécurité :</strong> ce mot de passe doit être changé à votre première connexion.`)}`;

  await sendEmail({
    email: args.email,
    name: args.name,
    subject: "Votre accès à l'espace Codialis",
    htmlContent: emailLayout({
      preheader: "Votre compte Codialis est prêt — voici vos identifiants.",
      bodyHtml: body,
    }),
  });
}

export async function sendResetEmail(args: {
  name: string;
  email: string;
  token: string;
}): Promise<void> {
  const url = actionUrl("reset", args.token);
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Mot de passe oublié</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(args.name)},</h1>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Vous avez demandé à réinitialiser votre mot de passe. Choisissez-en un nouveau ci-dessous.</p>
    ${ctaButton("Réinitialiser mon mot de passe", url)}
    ${notice("Ce lien est valable 1 heure et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez cet e-mail — votre mot de passe reste inchangé.")}`;

  await sendEmail({
    email: args.email,
    name: args.name,
    subject: "Réinitialisez votre mot de passe Codialis",
    htmlContent: emailLayout({
      preheader: "Réinitialisez votre mot de passe Codialis.",
      bodyHtml: body,
    }),
  });
}

// --- Notifications RH -------------------------------------------------------

const TONES = {
  green: { accent: "#15803d", soft: "#e9f7ee" },
  amber: { accent: "#b45309", soft: "#fdf3e3" },
  red: { accent: "#c0392b", soft: "#fdecea" },
};

export type NotifTone = keyof typeof TONES;

export async function sendHrNotifEmail(args: {
  email: string;
  name: string;
  subject: string;
  heading: string;
  intro: string;
  details?: [string, string][];
  tone?: NotifTone;
}): Promise<void> {
  const tone = TONES[args.tone ?? "green"];
  const rows = (args.details ?? [])
    .filter(([, v]) => String(v ?? "").trim() !== "")
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding:${i === 0 ? "0" : "10px"} 0 10px 0;border-top:${i === 0 ? "none" : `1px solid ${BRAND.line}`};font-size:12px;font-weight:600;color:${BRAND.muted};white-space:nowrap;vertical-align:top;width:38%">${escapeHtml(label)}</td>
          <td style="padding:${i === 0 ? "0" : "10px"} 0 10px 0;border-top:${i === 0 ? "none" : `1px solid ${BRAND.line}`};font-size:14px;font-weight:600;color:${BRAND.ink};text-align:right;vertical-align:top">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0">
      <tr><td style="background:${tone.soft};border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${tone.accent}">${escapeHtml(args.heading)}</td></tr>
    </table>
    <h1 style="margin:0 0 14px 0;font-size:23px;line-height:1.3;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(args.name)},</h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:${BRAND.ink}">${escapeHtml(args.intro)}</p>
    ${
      rows
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};border:1px solid ${BRAND.line};border-left:4px solid ${tone.accent};border-radius:10px;margin:0 0 28px 0">
             <tr><td style="padding:18px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
           </table>`
        : ""
    }
    ${ctaButton("Ouvrir l'espace Codialis", loginUrl())}`;

  await sendEmail({
    email: args.email,
    name: args.name,
    subject: args.subject,
    htmlContent: emailLayout({ preheader: args.intro, bodyHtml: body }),
  });
}

// --- Newsletter -------------------------------------------------------------

export async function sendNewsletterEmail(args: {
  email: string;
  title: string;
  excerpt: string;
}): Promise<void> {
  const url = `${siteOrigin()}/blog`;
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Nouvel article</p>
    <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.navy}">${escapeHtml(args.title)}</h1>
    <p style="margin:0 0 26px 0;font-size:15px;color:${BRAND.ink}">${escapeHtml(args.excerpt)}</p>
    ${ctaButton("Lire l'article", url)}
    ${notice(`Vous recevez cet e-mail car vous êtes inscrit·e à la newsletter Codialis. <a href="${escapeHtml(unsubscribeUrl(args.email))}" style="color:${BRAND.muted};text-decoration:underline">Se désinscrire</a>.`)}`;

  await sendEmail({
    email: args.email,
    name: args.email,
    subject: `Nouvel article : ${args.title}`,
    htmlContent: emailLayout({
      preheader: `Nouvel article sur le blog Codialis : ${args.title}`,
      bodyHtml: body,
    }),
  });
}

// Prévient tous les abonnés. Envoi séquentiel volontaire : Brevo limite le
// débit, et un lot d'un millier d'adresses envoyé d'un coup se fait étrangler.
export async function notifySubscribers(title: string, excerpt: string, emails: string[]) {
  let sent = 0;
  for (const email of emails) {
    try {
      await sendNewsletterEmail({ email, title, excerpt });
      sent++;
    } catch (err) {
      console.error(`Newsletter non envoyée à ${email} :`, err instanceof Error ? err.message : err);
    }
  }
  return { sent, total: emails.length };
}
