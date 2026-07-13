// Transactional email via Brevo (https://developers.brevo.com/reference/sendtransacemail).
// Node 20 ships a global fetch — no extra dependency needed.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function senderName() {
  return process.env.BREVO_SENDER_NAME || 'Codialis';
}
function senderEmail() {
  // Must be a validated sender in the Brevo account.
  return process.env.BREVO_SENDER_EMAIL || process.env.ADMIN_EMAIL || 'no-reply@codialis.fr';
}
function loginUrl() {
  return process.env.APP_LOGIN_URL || 'https://codialis.fr/admin';
}
// Optional hosted logo (white wordmark PNG). If unset, the header falls back to
// an HTML wordmark that renders even when the client blocks remote images.
function logoUrl() {
  return process.env.BREVO_LOGO_URL || '';
}

// Codialis brand tokens — kept in one place so every email stays on-brand.
const BRAND = {
  navy: '#08111e',
  panel: '#0f1c2e',
  green: '#2fed7f',
  ink: '#1a2432',
  muted: '#5c6b80',
  line: '#e4e8ee',
  page: '#f4f6f8',
  card: '#ffffff',
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%*?';
  while (true) {
    const bytes = randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
    if (/[A-ZÀ-ÖØ-Ý]/.test(out) && /[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]/.test(out) && /[a-z]/.test(out) && /[0-9]/.test(out)) {
      return out;
    }
  }
}

// Builds the welcome-email HTML (no side effects — handy for previews/tests).
export function renderWelcomeEmail({ name, email, password, role }) {
  const roleLabel = role === 'patron' ? 'Direction' : 'Employé';
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

    ${ctaButton('Se connecter', url)}

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
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${param}=${encodeURIComponent(token)}`;
}

// Account-confirmation email. No credentials here — clicking the link tells the
// server the address is genuine, after which the real password is issued.
export function renderVerifyEmail({ name, url, role }) {
  const roleLabel = role === 'patron' ? 'Direction' : 'Employé';
  const body = `
    <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.green}">Confirmez votre compte</p>
    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navy}">Bonjour ${escapeHtml(name)},</h1>
    <p style="margin:0 0 8px 0;font-size:15px;color:${BRAND.ink}">Un compte <strong style="color:${BRAND.navy}">${roleLabel}</strong> a été créé pour vous sur l'espace Codialis.</p>
    <p style="margin:0 0 22px 0;font-size:15px;color:${BRAND.ink}">Pour l'activer, confirmez que cette adresse email est bien la vôtre. Vos identifiants de connexion vous seront envoyés juste après.</p>

    ${ctaButton('Confirmer mon compte', url)}

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

    ${ctaButton('Réinitialiser mon mot de passe', url)}

    <p style="margin:22px 0 0 0;padding:14px 16px;background:#f4f6f8;border-left:3px solid ${BRAND.green};border-radius:0 8px 8px 0;font-size:13px;color:${BRAND.muted}">
      Ce lien est valable 1 heure et ne peut servir qu'une fois. Si vous n'avez rien demandé, ignorez cet email — votre mot de passe reste inchangé.
    </p>`;
  return emailLayout({
    preheader: `Réinitialisez votre mot de passe Codialis.`,
    bodyHtml: body,
  });
}

// Low-level Brevo send. Throws on API failure so callers can react.
async function sendEmail({ email, name, subject, htmlContent }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY manquant');

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName(), email: senderEmail() },
      to: [{ email, name }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

// Sends the welcome email carrying the generated password.
export async function sendWelcomeEmail({ name, email, password, role }) {
  return sendEmail({
    email, name,
    subject: 'Votre accès à l’espace Codialis',
    htmlContent: renderWelcomeEmail({ name, email, password, role }),
  });
}

// Sends the account-confirmation email carrying the verification link.
export async function sendVerifyEmail({ name, email, role, token }) {
  return sendEmail({
    email, name,
    subject: 'Confirmez votre compte Codialis',
    htmlContent: renderVerifyEmail({ name, role, url: actionUrl('verify', token) }),
  });
}

// Sends the password-reset email carrying the reset link.
export async function sendResetEmail({ name, email, token }) {
  return sendEmail({
    email, name,
    subject: 'Réinitialisation de votre mot de passe Codialis',
    htmlContent: renderResetEmail({ name, url: actionUrl('reset', token) }),
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
