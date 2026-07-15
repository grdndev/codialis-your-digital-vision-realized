import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requirePatron } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT = `
  SELECT id,
         employee_id AS "employeeId",
         type,
         to_char(start_date, 'YYYY-MM-DD') AS "startDate",
         to_char(end_date,   'YYYY-MM-DD') AS "endDate",
         half_day AS "halfDay",
         motif,
         status
  FROM absences`;

const TYPES = ['tt', 'conge', 'absence', 'formation'];

// GET /api/absences — patron sees all, employe sees own.
router.get('/', async (req, res) => {
  const sql = req.user.role === 'patron'
    ? `${SELECT} ORDER BY start_date DESC, created_at DESC`
    : `${SELECT} WHERE employee_id = $1 ORDER BY start_date DESC, created_at DESC`;
  const params = req.user.role === 'patron' ? [] : [req.user.id];
  const { rows } = await query(sql, params);
  res.json(rows);
});

// POST /api/absences — an employee requests an absence for themselves and it
// starts in 'attente'. A patron may file one for anyone and it's auto-'valide'
// — the patron has full rights and doesn't need to self-approve afterward.
router.post('/', async (req, res) => {
  const type = req.body?.type;
  const startDate = String(req.body?.startDate || '');
  const endDate = String(req.body?.endDate || startDate);
  const motif = String(req.body?.motif || '').trim();
  const isPatron = req.user.role === 'patron';
  const employeeId = (isPatron && req.body?.employeeId) ? req.body.employeeId : req.user.id;

  if (!isPatron && req.body?.employeeId && req.body.employeeId !== req.user.id) {
    return res.status(403).json({ error: 'Interdit' });
  }
  if (!TYPES.includes(type)) return res.status(400).json({ error: "Type d'absence invalide" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Date de début invalide' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return res.status(400).json({ error: 'Date de fin invalide' });
  if (endDate < startDate) return res.status(400).json({ error: 'La date de fin précède le début' });

  // A half-day only makes sense on a single-day absence.
  const halfDay = (startDate === endDate && (req.body?.halfDay === 'am' || req.body?.halfDay === 'pm')) ? req.body.halfDay : null;
  const status = isPatron ? 'valide' : 'attente';

  const { rows } = await query(
    `INSERT INTO absences (employee_id, type, start_date, end_date, half_day, motif, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, employee_id AS "employeeId", type,
               to_char(start_date,'YYYY-MM-DD') AS "startDate",
               to_char(end_date,'YYYY-MM-DD') AS "endDate",
               half_day AS "halfDay", motif, status`,
    [employeeId, type, startDate, endDate, halfDay, motif, status],
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/absences/:id { status } — patron validates/refuses.
router.patch('/:id', requirePatron, async (req, res) => {
  const status = req.body?.status;
  if (!['attente', 'valide', 'refuse'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  const { rows } = await query(
    `UPDATE absences SET status = $1 WHERE id = $2
     RETURNING id, employee_id AS "employeeId", type,
               to_char(start_date,'YYYY-MM-DD') AS "startDate",
               to_char(end_date,'YYYY-MM-DD') AS "endDate",
               half_day AS "halfDay", motif, status`,
    [status, req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Absence introuvable' });
  res.json(rows[0]);
});

// DELETE /api/absences/:id — owner (any status) or patron.
router.delete('/:id', async (req, res) => {
  const sql = req.user.role === 'patron'
    ? 'DELETE FROM absences WHERE id = $1 RETURNING id'
    : 'DELETE FROM absences WHERE id = $1 AND employee_id = $2 RETURNING id';
  const params = req.user.role === 'patron' ? [req.params.id] : [req.params.id, req.user.id];
  const { rowCount } = await query(sql, params);
  if (rowCount === 0) return res.status(404).json({ error: 'Absence introuvable' });
  res.json({ ok: true });
});

export default router;
