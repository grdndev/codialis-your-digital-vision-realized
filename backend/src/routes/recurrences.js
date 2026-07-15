import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requirePatron } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT = `
  SELECT id,
         employee_id AS "employeeId",
         effect,
         freq,
         weekday,
         monthday,
         half_day AS "halfDay",
         to_char(start_date, 'YYYY-MM-DD') AS "startDate",
         to_char(end_date,   'YYYY-MM-DD') AS "endDate",
         motif
  FROM recurrences`;

// GET /api/recurrences — patron sees all, employe sees own.
router.get('/', async (req, res) => {
  const sql = req.user.role === 'patron'
    ? `${SELECT} ORDER BY created_at DESC`
    : `${SELECT} WHERE employee_id = $1 ORDER BY created_at DESC`;
  const params = req.user.role === 'patron' ? [] : [req.user.id];
  const { rows } = await query(sql, params);
  res.json(rows);
});

// POST /api/recurrences — patron only (recurring rules are a management call).
router.post('/', requirePatron, async (req, res) => {
  const employeeId = req.body?.employeeId;
  // 'all' → applique la règle à tous les employés (une ligne par employé).
  const applyAll = employeeId === 'all';
  const effect = req.body?.effect;
  const freq = req.body?.freq;
  const halfDay = req.body?.halfDay === 'am' || req.body?.halfDay === 'pm' ? req.body.halfDay : null;
  const startDate = String(req.body?.startDate || '');
  const endDate = req.body?.endDate ? String(req.body.endDate) : null;
  const motif = String(req.body?.motif || '').trim();

  if (!employeeId) return res.status(400).json({ error: 'Employé requis' });
  if (!['present', 'tt', 'conge', 'absence', 'formation'].includes(effect)) return res.status(400).json({ error: 'Effet invalide' });
  if (!['weekly', 'biweekly', 'monthly', 'daily'].includes(freq)) return res.status(400).json({ error: 'Fréquence invalide' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Date de début invalide' });
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return res.status(400).json({ error: 'Date de fin invalide' });

  let weekday = null;
  let monthday = null;
  if (freq === 'monthly') {
    monthday = Number.parseInt(req.body?.monthday, 10);
    if (!Number.isInteger(monthday) || monthday < 1 || monthday > 31) return res.status(400).json({ error: 'Jour du mois invalide' });
  } else if (freq === 'daily') {
    // Plage continue : chaque jour ouvré entre start et end. Ni jour de semaine
    // ni jour du mois — la période (start/end) suffit.
    weekday = null;
    monthday = null;
  } else {
    weekday = Number.parseInt(req.body?.weekday, 10);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return res.status(400).json({ error: 'Jour de semaine invalide' });
  }

  let targets;
  if (applyAll) {
    const { rows } = await query(`SELECT id FROM users WHERE role = 'employe'`);
    targets = rows.map((r) => r.id);
    if (targets.length === 0) return res.status(400).json({ error: 'Aucun employé' });
  } else {
    targets = [employeeId];
  }

  const created = [];
  for (const empId of targets) {
    const { rows } = await query(
      `INSERT INTO recurrences (employee_id, effect, freq, weekday, monthday, half_day, start_date, end_date, motif)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, employee_id AS "employeeId", effect, freq, weekday, monthday,
                 half_day AS "halfDay", to_char(start_date,'YYYY-MM-DD') AS "startDate",
                 to_char(end_date,'YYYY-MM-DD') AS "endDate", motif`,
      [empId, effect, freq, weekday, monthday, halfDay, startDate, endDate, motif],
    );
    created.push(rows[0]);
  }
  // Toujours un tableau (1 ou N règles créées) — le front normalise.
  res.status(201).json(created);
});

// DELETE /api/recurrences/:id — patron only.
router.delete('/:id', requirePatron, async (req, res) => {
  const { rowCount } = await query('DELETE FROM recurrences WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Règle introuvable' });
  res.json({ ok: true });
});

export default router;
