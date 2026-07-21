import helmet from "helmet";
import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

// Fail fast: a missing or default JWT secret means anyone can forge a valid
// admin session. Refuse to boot rather than run with a guessable secret.
export function assertSecrets() {
  const secret = process.env.JWT_SECRET;
  const weak = !secret || secret.length < 32 || /change_?me/i.test(secret);
  if (weak) {
    throw new Error(
      "JWT_SECRET is missing, too short (<32 chars), or still the placeholder. " +
        "Generate one: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }
}

// Global headers for the whole site. The marketing pages pull a few known
// third-party origins (fonts, CDNs, Calendly), so the CSP allowlists those.
// Inline scripts/styles live in the static .dc.html pages, hence 'unsafe-inline'
// here — the stricter admin CSP below drops the CDN origins it never uses.
export const baseHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-eval' + inline event handlers are required by the dc-runtime
      // (support.js): it builds each component's logic class with new Function()
      // and binds template handlers as inline on* attributes. The framework
      // cannot run without them, so the CSP's XSS value here comes from the
      // remaining directives (origin allowlist, frame-ancestors, object-src…).
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://../assets.calendly.com",
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://../assets.calendly.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      // world map fetches its TopoJSON atlas from jsdelivr at runtime (index.html)
      connectSrc: [
        "'self'",
        "https://calendly.com",
        "https://cdn.jsdelivr.net",
      ],
      frameSrc: ["'self'", "https://calendly.com"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  // HSTS only makes sense once served over HTTPS in production.
  hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// The admin console must never be embedded in a frame and forbids proxy/browser
// caching of the sensitive shell — locked down harder than the marketing pages.
// It DOES load React/ReactDOM/Babel from unpkg though: the admin runs the same
// dc-runtime (support.js) as every other page, and that runtime injects those
// scripts from unpkg at runtime. Dropping unpkg here leaves window.React
// undefined and the whole admin renders blank.
export function adminSecurity(req, res, next) {
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // Admin console runs the same dc-runtime — see the note on baseHelmet.
        // unpkg is required (React/ReactDOM/Babel); the tighter allowlist still
        // drops jsdelivr/Calendly (admin uses neither) and forbids framing.
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://unpkg.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
  })(req, res, () => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    next();
  });
}

// Never let a proxy or browser cache authenticated API payloads (HR data,
// account lists, etc.).
export function noStore(req, res, next) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  next();
}

// Brute-force guard on the login endpoint: cap attempts per IP. Keyed on IP so
// a single attacker can't spray passwords, while legitimate typos stay usable.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Trop de tentatives de connexion — réessayez dans 15 minutes",
  },
});

// Tighter cap on the account-recovery / verification endpoints to stop email
// flooding and token-guessing.
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes — réessayez plus tard" },
});
