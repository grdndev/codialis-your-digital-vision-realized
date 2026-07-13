import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requirePatron } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// entry_date is a DATE; return it as a plain 'YYYY-MM-DD' string.
const SELECT = `
  SELECT id,
         employee_id AS "employeeId",
         kind,
         to_char(entry_date, 'YYYY-MM-DD') AS date,
         hours::float AS hours,
         motif,
         status
  FROM entries`;

// GET /api/entries — patron sees all, employe sees own
router.get('/', async (req, res) => {
  const sql = req.user.role === 'patron'
    ? `${SELECT} ORDER BY entry_date DESC, created_at DESC`
    : `${SELECT} WHERE employee_id = $1 ORDER BY entry_date DESC, created_at DESC`;
  const params = req.user.role === 'patron' ? [] : [req.user.id];
  const { rows } = await query(sql, params);
  res.json(rows);
});

// POST /api/entries — an employee (or patron) declares hours for themselves.
router.post('/', async (req, res) => {
  const kind = req.body?.kind === 'recup' ? 'recup' : 'sup';
  const date = String(req.body?.date || '');
  const hours = Number.parseFloat(req.body?.hours);
  const motif = String(req.body?.motif || '').trim();
  // A patron may create a recup entry for another employee (planning).
  const employeeId = (req.user.role === 'patron' && req.body?.employeeId) ? req.body.employeeId : req.user.id;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Date invalide' });
  if (!Number.isFinite(hours) || hours <= 0) return res.status(400).json({ error: 'Heures invalides' });

  const { rows } = await query(
    `INSERT INTO entries (employee_id, kind, entry_date, hours, motif, status)
     VALUES ($1, $2, $3, $4, $5, 'attente')
     RETURNING id, employee_id AS "employeeId", kind,
               to_char(entry_date,'YYYY-MM-DD') AS date, hours::float AS hours, motif, status`,
    [employeeId, kind, date, hours, motif],
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/entries/:id { status } — patron validates/refuses
router.patch('/:id', requirePatron, async (req, res) => {
  const status = req.body?.status;
  if (!['attente', 'valide', 'refuse'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  const { rows } = await query(
    `UPDATE entries SET status = $1 WHERE id = $2
     RETURNING id, employee_id AS "employeeId", kind,
               to_char(entry_date,'YYYY-MM-DD') AS date, hours::float AS hours, motif, status`,
    [status, req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Demande introuvable' });
  res.json(rows[0]);
});

// DELETE /api/entries/:id — owner (any status) or patron
router.delete('/:id', async (req, res) => {
  const sql = req.user.role === 'patron'
    ? 'DELETE FROM entries WHERE id = $1 RETURNING id'
    : 'DELETE FROM entries WHERE id = $1 AND employee_id = $2 RETURNING id';
  const params = req.user.role === 'patron' ? [req.params.id] : [req.params.id, req.user.id];
  const { rowCount } = await query(sql, params);
  if (rowCount === 0) return res.status(404).json({ error: 'Demande introuvable' });
  res.json({ ok: true });
});

export default router;
