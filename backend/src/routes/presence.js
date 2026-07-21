import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, isManager } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/presence — nested map { employeeId: { 'YYYY-MM-DD': status } }
// direction/chef de projet voient tout le monde, employé voit seulement le sien.
router.get('/', async (req, res) => {
  const sql = isManager(req.user)
    ? `SELECT employee_id, to_char(day,'YYYY-MM-DD') AS day, status FROM presence`
    : `SELECT employee_id, to_char(day,'YYYY-MM-DD') AS day, status FROM presence WHERE employee_id = $1`;
  const params = isManager(req.user) ? [] : [req.user.id];
  const { rows } = await query(sql, params);
  const map = {};
  for (const r of rows) {
    (map[r.employee_id] ||= {})[r.day] = r.status;
  }
  res.json(map);
});

// PUT /api/presence { employeeId, date, status }
// status null/empty removes the cell. Employe may only edit self.
router.put('/', async (req, res) => {
  const date = String(req.body?.date || '');
  const status = req.body?.status || null;
  const employeeId = (req.user.role === 'patron' && req.body?.employeeId) ? req.body.employeeId : req.user.id;

  if (req.user.role !== 'patron' && req.body?.employeeId && req.body.employeeId !== req.user.id) {
    return res.status(403).json({ error: 'Interdit' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Date invalide' });

  if (status === null || status === '') {
    await query('DELETE FROM presence WHERE employee_id = $1 AND day = $2', [employeeId, date]);
    return res.json({ ok: true });
  }
  if (!['present', 'tt', 'conge'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  await query(
    `INSERT INTO presence (employee_id, day, status) VALUES ($1, $2, $3)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [employeeId, date, status],
  );
  res.json({ ok: true });
});

export default router;
