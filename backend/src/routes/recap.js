import { Router } from 'express';
import { requireAuth, requirePatron } from '../middleware/auth.js';
import { runMonthlyRecap } from '../recap-cron.js';

const router = Router();
router.use(requireAuth);

// POST /api/recap/run-monthly — patron uniquement. Déclenche MAINTENANT l'envoi
// du récap mensuel (test / rattrapage). Corps optionnel :
//   { year, month }   mois 1-12 ciblé (sinon = mois précédent)
//   { dryRun: true }  génère les PDF et compte, SANS envoyer d'email (test sûr)
//   { onlyMe: true }  n'envoie qu'à vous (le patron connecté), pas à l'équipe
router.post('/run-monthly', requirePatron, async (req, res) => {
  const opts = {};
  if (req.body?.year != null && req.body?.month != null) {
    const year = Number.parseInt(req.body.year, 10);
    const month = Number.parseInt(req.body.month, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ error: 'Année invalide' });
    if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Mois invalide (1-12)' });
    opts.year = year; opts.month0 = month - 1;
  }
  if (req.body?.dryRun === true) opts.dryRun = true;
  if (req.body?.onlyMe === true) opts.onlyEmail = req.user.email;
  try {
    const result = await runMonthlyRecap(opts);
    res.json(result);
  } catch (err) {
    console.error('run-monthly:', err?.message || err);
    res.status(500).json({ error: 'Échec de la génération/envoi du récap' });
  }
});

export default router;
