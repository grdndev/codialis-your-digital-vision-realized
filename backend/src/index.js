import express from 'express';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import authRoutes from './routes/auth.js';
import accountsRoutes from './routes/accounts.js';
import entriesRoutes from './routes/entries.js';
import presenceRoutes from './routes/presence.js';
import contentRoutes from './routes/content.js';
import settingsRoutes from './routes/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// New layout: repo/backend/src/index.js -> repo/frontend/{www,assets,public}
const frontRoot = join(__dirname, '..', '..', 'frontend');
const siteRoot = join(frontRoot, 'www'); // the .dc.html pages, index.html, support.js…

const app = express();
app.use(express.json({ limit: '8mb' })); // images arrive as data URLs
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/settings', settingsRoutes);

// Anything else that hit /api is a genuine 404, not a static file.
app.use('/api', (req, res) => res.status(404).json({ error: 'Route API inconnue' }));

// --- Frontend routing: clean URLs -> the .dc.html page in www ---
// The raw /Xxx.dc.html paths still work (served by express.static below),
// so existing relative links and the dc-runtime sibling fetches keep working.
const PAGES = {
  '/': 'index.html',
  '/portfolio': 'Portfolio.dc.html',
  '/blog': 'Blog.dc.html',
  '/contact': 'Contact.dc.html',
  '/financement': 'Financement.dc.html',
  '/legal': 'Legal.dc.html',
  '/admin': 'Admin.dc.html',
};
// Redirect a trailing slash to the bare path so relative asset/component
// URLs in the page always resolve against the site root, not /blog/.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.length > 1 && req.path.endsWith('/')) {
    const bare = req.path.slice(0, -1);
    if (PAGES[bare]) return res.redirect(301, bare + req.url.slice(req.path.length));
  }
  next();
});
for (const [route, file] of Object.entries(PAGES)) {
  app.get(route, (req, res) => res.sendFile(join(siteRoot, file)));
}

// Serve the static site (index.html, *.dc.html, support.js, …)
app.use(express.static(siteRoot, { extensions: ['html'] }));
// Assets and public media live outside www; pages reference them as /assets and /public.
app.use('/assets', express.static(join(frontRoot, 'assets')));
app.use('/public', express.static(join(frontRoot, 'public')));

// Central error handler — never leak stack traces to the client.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Codialis server on http://localhost:${port}`);
});
