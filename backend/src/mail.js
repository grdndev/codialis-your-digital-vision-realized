// Transactional email via Brevo (https://developers.brevo.com/reference/sendtransacemail).
// Node 20 ships a global fetch — no extra dependency needed.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { signUnsubscribe } from "./tokens.js";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

function senderName() {
  return process.env.BREVO_SENDER_NAME || "Codialis";
}
function senderEmail() {
  // Must be a validated sender in the Brevo account.
  return (
    process.env.BREVO_SENDER_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "no-reply@codialis.com"
  );
}
function loginUrl() {
  return process.env.APP_LOGIN_URL || "https://codialis.com/admin";
}
// Same origin the backend is served on (frontend + API share one Express app).
function siteOrigin() {
  try {
    return new URL(loginUrl()).origin;
  } catch {
    return "https://codialis.com";
  }
}
function blogUrl() {
  return process.env.APP_BLOG_URL || `${siteOrigin()}/blog`;
}
function unsubscribeUrl(email) {
  const token = signUnsubscribe(email);
  return `${siteOrigin()}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
// Optional hosted logo (white wordmark PNG). If unset, the header falls back to
// an HTML wordmark that renders even when the client blocks remote images.
function logoUrl() {
  return process.env.BREVO_LOGO_URL || "";
}

// Codialis brand tokens — kept in one place so every email stays on-brand.
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

// Header wordmark: hosted PNG when available, otherwise a CSS wordmark that
// mirrors the logo (uppercase, wide tracking, green square "dot").
function brandMark() {
  const src = logoUrl();
  if (src) {
    return `<img src="${src}" alt="Codialis" width="150" height="34"
      style="display:block;border:0;height:34px;width:auto;max-width:150px" />`;
  }
  return `<span style="font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;letter-spacing:.14em;color:#ffffff;text-transform:uppercase">CODIALIS</span><span style="display:inline-block;width:9px;height:9px;background:${BRAND.green};margin-left:4px;vertical-align:baseline"></span>`;
}

// Bulletproof CTA (VML fallback keeps the button solid in Outlook).
function ctaButton(label, url) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0">
    <tr><td align="center" bgcolor="${BRAND.green}" style="border-radius:10px">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px;v-text-anchor:middle;width:220px" arcsize="22%" fillcolor="${BRAND.green}" stroked="f"><w:anchorlock/><center style="color:${BRAND.navy};font-family:Arial,sans-serif;font-size:15px;font-weight:bold"><![endif]-->
      <a href="${url}" style="display:inline-block;padding:14px 32px;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${BRAND.navy};text-decoration:none;border-radius:10px">${label}</a>
      <!--[if mso]></center></v:roundrect><![endif]-->
    </td></tr>
  </table>`;
}

// Shared responsive shell. `preheader` is the hidden inbox-preview line;
// `bodyHtml` is dropped into the white content card.
function emailLayout({ preheader, bodyHtml }) {
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
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(8,17,30,.08)">
        <tr><td style="background:${BRAND.navy};padding:26px 36px">
          ${brandMark()}
        </td></tr>
        <tr><td style="height:4px;background:${BRAND.green};line-height:4px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:${BRAND.card};padding:36px 36px 40px 36px;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;color:${BRAND.ink};line-height:1.6">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:${BRAND.navy};padding:22px 36px;font-family:Arial,Helvetica,sans-serif">
          <p style="margin:0 0 4px 0;font-size:13px;color:#ffffff;font-weight:700;letter-spacing:.04em">Codialis</p>
          <p style="margin:0;font-size:12px;color:#8a99ad;line-height:1.5">Votre partenaire digital. Cet email vous a été envoyé automatiquement, merci de ne pas y répondre.</p>
          <p style="margin:12px 0 0 0;font-size:11px;color:#5c6b80">© ${year} Codialis — Tous droits réservés</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Generates a readable strong password (no ambiguous chars like O/0, l/1) enforcing uppercase and special chars.
export function generatePassword(len = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%*?";
  while (true) {
    const bytes = randomBytes(len);
    let out = "";
    for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
    if (
      /[A-ZÀ-ÖØ-Ý]/.test(out) &&
      /[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]/.test(out) &&
      /[a-z]/.test(out) &&
      /[0-9]/.test(out)
    ) {
      return out;
    }
  }
}

// Builds the welcome-email HTML (no side effects — handy for previews/tests).
export function renderWelcomeEmail({ name, email, password, role }) {
  const roleLabel =
    role === "patron"
      ? "Direction"
      : role === "chef"
        ? "Chef de projet"
        : "Employé";
  const url = loginUrl();

  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Bienvenue à bord</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(name)},</h1>
    <p style="margin:0 0 8px 0;font-size:15px;color:${BRAND.ink}">Un compte <strong style="color:${BRAND.navy}">${roleLabel}</strong> vient d'être créé pour vous sur l'espace Codialis.</p>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Voici vos identifiants de connexion :</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.panel};border-radius:12px;margin:0 0 26px 0">
      <tr><td style="padding:22px 24px">
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a99ad">Email</p>
        <p style="margin:0 0 18px 0;font-family:'IBM Plex Mono',Consolas,monospace;font-size:15px;color:#ffffff;word-break:break-all">${escapeHtml(email)}</p>
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a99ad">Mot de passe</p>
        <p style="margin:0;font-family:'IBM Plex Mono',Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:.02em;color:${BRAND.green};word-break:break-all">${escapeHtml(password)}</p>
      </td></tr>
    </table>

    ${ctaButton("Se connecter", url)}

    <p style="margin:22px 0 0 0;padding:14px 16px;background:#f4f6f8;border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">
      <strong style="color:${BRAND.ink}">Astuce sécurité :</strong> changez ce mot de passe dès votre première connexion.
    </p>`;

  return emailLayout({
    preheader: `Votre compte ${roleLabel} Codialis est prêt — voici vos identifiants.`,
    bodyHtml: body,
  });
}

// Builds a link back to the admin app carrying a one-shot token as a query
// param (e.g. ?verify=... or ?reset=...). Base is the configured login URL.
function actionUrl(param, token) {
  const base = loginUrl();
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${encodeURIComponent(token)}`;
}

// Account-confirmation email. No credentials here — clicking the link tells the
// server the address is genuine, after which the real password is issued.
export function renderVerifyEmail({ name, url, role }) {
  const roleLabel =
    role === "patron"
      ? "Direction"
      : role === "chef"
        ? "Chef de projet"
        : "Employé";
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Confirmez votre compte</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(name)},</h1>
    <p style="margin:0 0 8px 0;font-size:15px;color:${BRAND.ink}">Un compte <strong style="color:${BRAND.navy}">${roleLabel}</strong> a été créé pour vous sur l'espace Codialis.</p>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Pour l'activer, confirmez que cette adresse email est bien la vôtre. Vos identifiants de connexion vous seront envoyés juste après.</p>

    ${ctaButton("Confirmer mon compte", url)}

    <p style="margin:22px 0 0 0;padding:14px 16px;background:#f4f6f8;border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">
      Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
    </p>`;
  return emailLayout({
    preheader: `Confirmez votre compte Codialis pour recevoir vos identifiants.`,
    bodyHtml: body,
  });
}

// Password-reset email. Clicking the link opens the reset form in the app.
export function renderResetEmail({ name, url }) {
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Mot de passe oublié</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(name)},</h1>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous pour en choisir un nouveau.</p>

    ${ctaButton("Réinitialiser mon mot de passe", url)}

    <p style="margin:22px 0 0 0;padding:14px 16px;background:#f4f6f8;border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">
      Ce lien est valable 1 heure et ne peut servir qu'une fois. Si vous n'avez rien demandé, ignorez cet email — votre mot de passe reste inchangé.
    </p>`;
  return emailLayout({
    preheader: `Réinitialisez votre mot de passe Codialis.`,
    bodyHtml: body,
  });
}

// New-article newsletter email, sent to subscribers when a blog post is published.
export function renderNewsletterEmail({ title, excerpt, url, email }) {
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Nouvel article</p>
    <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.navy}">${escapeHtml(title)}</h1>
    <p style="margin:0 0 26px 0;font-size:15px;color:${BRAND.ink}">${escapeHtml(excerpt || "")}</p>

    ${ctaButton("Lire l'article", url)}

    <p style="margin:22px 0 0 0;padding:14px 16px;background:#f4f6f8;border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">
      Vous recevez cet email car vous êtes inscrit·e à la newsletter Codialis. <a href="${unsubscribeUrl(email)}" style="color:${BRAND.muted};text-decoration:underline">Se désinscrire</a>.
    </p>`;
  return emailLayout({
    preheader: `Nouvel article sur le blog Codialis : ${title}`,
    bodyHtml: body,
  });
}

// Sends the new-article email to one subscriber.
export async function sendNewsletterEmail({ email, title, excerpt, url }) {
  return sendEmail({
    email,
    name: email,
    subject: `Nouvel article — ${title}`,
    htmlContent: renderNewsletterEmail({ title, excerpt, url, email }),
  });
}

// Sends the new-article email to every subscriber. Best-effort: one failure
// doesn't stop the others, and the caller decides whether to await this.
export async function sendNewsletterToSubscribers(
  subscribers,
  { title, excerpt },
) {
  const url = blogUrl();
  const results = await Promise.allSettled(
    subscribers.map((s) =>
      sendNewsletterEmail({ email: s.email, title, excerpt, url }),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected")
      console.error(
        `Newsletter send failed for ${subscribers[i].email}:`,
        r.reason?.message || r.reason,
      );
  });
}

// Low-level Brevo send. Throws on API failure so callers can react.
// `attachments` : [{ name, content }] où content est un Buffer OU une chaîne
// base64 (Brevo attend du base64).
async function sendEmail({ email, name, subject, htmlContent, attachments }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY manquant");

  const payload = {
    sender: { name: senderName(), email: senderEmail() },
    to: [{ email, name }],
    subject,
    htmlContent,
  };
  if (attachments && attachments.length) {
    payload.attachment = attachments.map((a) => ({
      name: a.name,
      content: Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : a.content,
    }));
  }

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

// Sends the welcome email carrying the generated password.
export async function sendWelcomeEmail({ name, email, password, role }) {
  return sendEmail({
    email,
    name,
    subject: "Votre accès à l’espace Codialis",
    htmlContent: renderWelcomeEmail({ name, email, password, role }),
  });
}

// Sends the account-confirmation email carrying the verification link.
export async function sendVerifyEmail({ name, email, role, token }) {
  return sendEmail({
    email,
    name,
    subject: "Confirmez votre compte Codialis",
    htmlContent: renderVerifyEmail({
      name,
      role,
      url: actionUrl("verify", token),
    }),
  });
}

// Palette de tons : accent lisible (texte/bord) + fond pastel doux.
// Pensée pour rester contrastée sur fond blanc, sans agresser l'œil.
const TONES = {
  green: { accent: "#15803d", soft: "#e9f7ee", line: "#bfe6cd" },
  amber: { accent: "#b45309", soft: "#fdf3e3", line: "#f2dcae" },
  red: { accent: "#c0392b", soft: "#fdecea", line: "#f3c8c2" },
};

// Notification RH générique (demande créée, demande validée/refusée…).
// `details` : liste de paires [label, valeur] affichées dans une carte claire.
// `tone` : green (info/validé) | amber (à traiter) | red (refusé).
export function renderHrNotifEmail({
  heading,
  name,
  intro,
  details = [],
  tone = "green",
}) {
  const t = TONES[tone] || TONES.green;
  const rows = details
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding:${i === 0 ? "0" : "10px"} 0 10px 0;border-top:${i === 0 ? "none" : `1px solid ${BRAND.line}`};font-size:12px;font-weight:600;letter-spacing:.02em;color:${BRAND.muted};white-space:nowrap;vertical-align:top;width:38%">${escapeHtml(label)}</td>
          <td style="padding:${i === 0 ? "0" : "10px"} 0 10px 0;border-top:${i === 0 ? "none" : `1px solid ${BRAND.line}`};font-size:14px;font-weight:600;color:${BRAND.ink};text-align:right;vertical-align:top">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  const badge = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0">
      <tr><td style="background:${t.soft};border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${t.accent}">${escapeHtml(heading)}</td></tr>
    </table>`;
  const body = `
    ${badge}
    <h1 style="margin:0 0 14px 0;font-size:23px;line-height:1.3;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(name)},</h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:${BRAND.ink}">${escapeHtml(intro)}</p>
    ${
      rows
        ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};border:1px solid ${BRAND.line};border-left:4px solid ${t.accent};border-radius:10px;margin:0 0 28px 0">
      <tr><td style="padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      </td></tr>
    </table>`
        : ""
    }
    ${ctaButton("Ouvrir l'espace Codialis", loginUrl())}`;
  return emailLayout({ preheader: intro, bodyHtml: body });
}

// Envoie une notification RH à un destinataire. Best-effort côté appelant :
// ne jamais bloquer la réponse HTTP sur un échec Brevo.
export async function sendHrNotifEmail({
  email,
  name,
  subject,
  heading,
  intro,
  details,
  tone,
}) {
  return sendEmail({
    email,
    name,
    subject,
    htmlContent: renderHrNotifEmail({ heading, name, intro, details, tone }),
  });
}

// Récap mensuel : email accompagnant le PDF du mois écoulé.
export function renderMonthlyRecapEmail({ name, periodLabel, isTeam }) {
  const intro = isTeam
    ? `Voici le récapitulatif RH de toute l'équipe pour ${periodLabel}, en pièce jointe (PDF).`
    : `Voici votre récapitulatif d'activité pour ${periodLabel} (heures, congés, absences), en pièce jointe (PDF).`;
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Récapitulatif mensuel</p>
    <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(name)},</h1>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">${escapeHtml(intro)}</p>
    ${ctaButton("Ouvrir l'espace Codialis", loginUrl())}
    <p style="margin:22px 0 0 0;padding:14px 16px;background:#f4f6f8;border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">
      Ce récapitulatif est envoyé automatiquement chaque début de mois. Pour toute question, contactez la direction.
    </p>`;
  return emailLayout({
    preheader: `Votre récapitulatif ${periodLabel} Codialis`,
    bodyHtml: body,
  });
}

// Envoie le récap mensuel avec le PDF en pièce jointe.
export async function sendMonthlyRecapEmail({
  email,
  name,
  periodLabel,
  pdf,
  isTeam = false,
}) {
  return sendEmail({
    email,
    name,
    subject: `Récapitulatif ${periodLabel} — Codialis`,
    htmlContent: renderMonthlyRecapEmail({ name, periodLabel, isTeam }),
    attachments: [{ name: pdf.filename, content: pdf.buffer }],
  });
}

// Sends the password-reset email carrying the reset link.
export async function sendResetEmail({ name, email, token }) {
  return sendEmail({
    email,
    name,
    subject: "Réinitialisation de votre mot de passe Codialis",
    htmlContent: renderResetEmail({ name, url: actionUrl("reset", token) }),
  });
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
