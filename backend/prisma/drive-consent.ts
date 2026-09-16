import { createInterface } from "node:readline/promises";

// Obtention du refresh token Google Drive, à faire UNE FOIS.
//
//   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… npx tsx prisma/drive-consent.ts
//
// Le script affiche une URL, vous vous connectez avec le compte Google qui
// hébergera les fichiers, Google vous renvoie un code, vous le collez ici, et
// le script imprime le refresh token à poser dans backend/.env.
//
// Deux points qui font échouer le reste s'ils sont manqués :
//
//   - l'écran de consentement doit être publié « En production ». En mode
//     « Test », le refresh token expire au bout de 7 jours et les envois
//     cesseront sans prévenir ;
//   - l'URI de redirection déclarée sur l'ID client doit contenir exactement
//     `urn:ietf:wg:oauth:2.0:oob` OU `http://localhost` selon le type de client.
//     On utilise ici la seconde, acceptée par les clients « Application Web ».
//
// Le scope demandé est `drive.file` et rien d'autre : l'application ne verra
// que les fichiers qu'elle aura elle-même créés. C'est ce qui évite la revue
// de sécurité de Google, réservée aux scopes restreints.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT = process.env.GOOGLE_REDIRECT_URI || "http://localhost";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont requis.");
  console.error("  GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… npx tsx prisma/drive-consent.ts");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // `offline` est ce qui déclenche l'émission d'un refresh token ; `consent`
    // force l'écran même si l'accès a déjà été donné, sans quoi Google ne
    // renvoie pas de refresh token la deuxième fois.
    access_type: "offline",
    prompt: "consent",
  });

console.log("\n1. Ouvrez cette adresse, connecté au compte Google qui hébergera les fichiers :\n");
console.log(authUrl);
console.log(
  "\n2. Après validation, le navigateur sera redirigé vers une page en erreur :",
  "\n   c'est normal. Copiez la valeur du paramètre `code=` dans son URL.\n",
);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question("3. Collez le code ici : ")).trim();
rl.close();

if (!code) {
  console.error("Aucun code fourni.");
  process.exit(1);
}

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});

const data = (await res.json()) as { refresh_token?: string; error_description?: string; error?: string };

if (!res.ok || !data.refresh_token) {
  console.error("\nÉchec :", data.error_description ?? data.error ?? `HTTP ${res.status}`);
  console.error(
    "Si l'erreur parle de `redirect_uri_mismatch`, l'URI déclarée sur l'ID client",
    `ne correspond pas à « ${REDIRECT} ».`,
  );
  process.exit(1);
}

console.log("\nÀ poser dans backend/.env :\n");
console.log(`GOOGLE_CLIENT_ID="${CLIENT_ID}"`);
console.log(`GOOGLE_CLIENT_SECRET="${CLIENT_SECRET}"`);
console.log(`GOOGLE_REFRESH_TOKEN="${data.refresh_token}"`);
console.log(
  "\nCe jeton vaut tant que l'application OAuth reste publiée « En production »",
  "et que l'accès n'est pas révoqué.\n",
);
