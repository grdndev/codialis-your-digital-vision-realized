// Doit être importé AVANT les routes : patche express pour que toute promesse
// rejetée dans un handler `async` soit routée vers le gestionnaire d'erreur
// central (réponse 500 propre) au lieu de devenir une unhandledRejection qui
// tuait le process entier.
import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import accountsRoutes from "./routes/accounts.js";
import entriesRoutes from "./routes/entries.js";
import presenceRoutes from "./routes/presence.js";
import recurrencesRoutes from "./routes/recurrences.js";
import absencesRoutes from "./routes/absences.js";
import contentRoutes from "./routes/content.js";
import { query } from "./db.js";
import settingsRoutes from "./routes/settings.js";
import newsletterRoutes from "./routes/newsletter.js";
import contactRoutes from "./routes/contact.js";
import recapRoutes from "./routes/recap.js";
import feedsRoutes from "./routes/feeds.js";
import { startRecapScheduler } from "./recap-cron.js";
import {
  assertSecrets,
  baseHelmet,
  noStore,
} from "./middleware/security.js";

// Refuse to start with a missing/placeholder JWT secret.
assertSecrets();

const app = express();
// Behind a reverse proxy in production: trust it so rate-limit sees the real
// client IP and the Secure cookie flag works.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.disable("x-powered-by");

// API-only server: the static site is hosted separately (Hostinger), so every
// browser request is cross-origin. Allow the front-end origins listed in
// CORS_ORIGINS (comma-separated) and send credentials so the auth cookie flows.
// Requests with no Origin header (curl, server-to-server, health checks) pass.
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "https://codialis.com,https://www.codialis.com,http://localhost:3001"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origine non autorisée par CORS: " + origin));
    },
    credentials: true,
  }),
);

app.use(baseHelmet); // security headers for API responses
app.use(express.json({ limit: "8mb" })); // images arrive as data URLs
app.use(cookieParser());

// Authenticated API payloads must never be cached by a proxy or the browser.
app.use("/api", noStore);
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/entries", entriesRoutes);
app.use("/api/presence", presenceRoutes);
app.use("/api/recurrences", recurrencesRoutes);
app.use("/api/absences", absencesRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/recap", recapRoutes);
app.use("/api/feeds", feedsRoutes);

// Anything else that hit /api is a genuine 404, not a static file.
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Route API inconnue" }),
);

// The front-end (static site) is deployed separately; this server only exposes
// the API. A bare hit on the root is not an error — return a small liveness JSON.
app.get("/", (req, res) => res.json({ service: "codialis-api", ok: true }));

// Central error handler — never leak stack traces to the client.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erreur serveur" });
});

// Filet de sécurité pour tout rejet/exception NON capturé par express (tâches
// planifiées, timers, callbacks). On log au lieu de laisser Node tuer le process
// — un seul rejet ne doit jamais mettre toute l'API à terre.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (serveur maintenu en vie):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (serveur maintenu en vie):", err);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Codialis server on http://localhost:${port}`);
  // Préchauffe la base au démarrage : la toute première requête déclenche sinon
  // le rejeu complet du schéma + migrations d'index (lent). On paie ce coût au
  // boot, pas sur le dos du premier visiteur.
  query("SELECT 1")
    .then(() => console.log("DB warm"))
    .catch((e) => console.error("DB warmup failed:", e.message));
  // Planifie l'envoi automatique du récap mensuel (1er du mois, 08:00 Paris).
  startRecapScheduler();
});
