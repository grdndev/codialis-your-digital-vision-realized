import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyAbsenceCreated, notifyAbsenceDecided } from '../notify.js';
import { canPostLeave, availableLeave } from '../balances.js';

// Message d'erreur commun quand une demande dépasse le solde de congés.
function leaveError(check) {
  return `Solde de congés insuffisant : ${check.cost} j demandé(s) pour ${check.available} j disponible(s).`;
}

// Un congé/absence payé exige un solde de congés défini par la direction :
// sans solde, rien à décompter. On refuse la pose et on invite à le définir.
// Renvoie une chaîne d'erreur si bloqué, sinon null.
async function leaveUndefinedError(employeeId, { type, paid }) {
  if (paid === false || (type !== 'conge' && type !== 'absence')) return null;
  const { defined } = await availableLeave(employeeId);
  return defined ? null : 'Solde de congés non défini : la direction doit le définir avant de poser un congé.';
}

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
         status,
         paid
  FROM absences`;

const RETURNING = `
     RETURNING id, employee_id AS "employeeId", type,
               to_char(start_date,'YYYY-MM-DD') AS "startDate",
               to_char(end_date,'YYYY-MM-DD') AS "endDate",
               half_day AS "halfDay", motif, status, paid`;

// Payé/non payé : seul le patron le fixe. Une demande d'employé part toujours
// « payé » — la direction tranche à la validation.
function paidFrom(req, fallback = true) {
  if (req.user.role !== 'patron') return fallback;
  if (req.body?.paid === undefined) return fallback;
  return req.body.paid !== false;
}

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

  const paid = paidFrom(req);

  // Le solde doit être défini avant tout congé payé (rien à décompter sinon).
  const undef = await leaveUndefinedError(employeeId, { type, paid });
  if (undef) return res.status(400).json({ error: undef });

  // Un congé/absence payé ne peut pas faire passer le solde de congés sous zéro.
  const check = await canPostLeave(employeeId, { type, paid, startDate, endDate, halfDay });
  if (!check.ok) return res.status(400).json({ error: leaveError(check) });

  const { rows } = await query(
    `INSERT INTO absences (employee_id, type, start_date, end_date, half_day, motif, status, paid)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)${RETURNING}`,
    [employeeId, type, startDate, endDate, halfDay, motif, status, paid],
  );
  // Notification email (employé → patrons, patron → employé). Fire-and-forget.
  notifyAbsenceCreated({ absence: rows[0], actor: req.user }).catch((err) => console.error('notifyAbsenceCreated:', err?.message || err));
  res.status(201).json(rows[0]);
});

// PATCH /api/absences/:id — two shapes:
//  { status }                        — patron validates/refuses.
//  { type, startDate, endDate, ... }  — edit an existing absence instead of
//                                       stacking a new one on the same day.
//                                       Owner may edit their own while still
//                                       'attente'; patron may edit anything
//                                       and it stays/becomes 'valide'.
router.patch('/:id', async (req, res) => {
  const { rows: existingRows } = await query(
    `SELECT employee_id, status, paid, type, half_day AS "halfDay",
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date,   'YYYY-MM-DD') AS "endDate"
     FROM absences WHERE id = $1`,
    [req.params.id],
  );
  if (existingRows.length === 0) return res.status(404).json({ error: 'Absence introuvable' });
  const existing = existingRows[0];
  const isPatron = req.user.role === 'patron';
  const isOwner = existing.employee_id === req.user.id;
  if (!isPatron && !isOwner) return res.status(403).json({ error: 'Interdit' });

  const isFieldEdit = req.body?.type !== undefined || req.body?.startDate !== undefined;

  if (isFieldEdit) {
    if (!isPatron && existing.status !== 'attente') {
      return res.status(403).json({ error: 'Déjà traitée — modification impossible' });
    }
    const type = req.body?.type;
    const startDate = String(req.body?.startDate || '');
    const endDate = String(req.body?.endDate || startDate);
    const motif = String(req.body?.motif || '').trim();
    if (!TYPES.includes(type)) return res.status(400).json({ error: "Type d'absence invalide" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Date de début invalide' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return res.status(400).json({ error: 'Date de fin invalide' });
    if (endDate < startDate) return res.status(400).json({ error: 'La date de fin précède le début' });
    const halfDay = (startDate === endDate && (req.body?.halfDay === 'am' || req.body?.halfDay === 'pm')) ? req.body.halfDay : null;
    const status = isPatron ? 'valide' : 'attente';
    const paid = paidFrom(req, existing.paid);
    // Le solde doit être défini avant tout congé payé.
    const undef = await leaveUndefinedError(existing.employee_id, { type, paid });
    if (undef) return res.status(400).json({ error: undef });
    // Revérifie le solde en ignorant cette absence (on la remplace).
    const check = await canPostLeave(existing.employee_id, { type, paid, startDate, endDate, halfDay, excludeAbsenceId: req.params.id });
    if (!check.ok) return res.status(400).json({ error: leaveError(check) });
    const { rows } = await query(
      `UPDATE absences SET type = $1, start_date = $2, end_date = $3, half_day = $4, motif = $5, status = $6, paid = $7
       WHERE id = $8${RETURNING}`,
      [type, startDate, endDate, halfDay, motif, status, paid, req.params.id],
    );
    return res.json(rows[0]);
  }

  if (!isPatron) return res.status(403).json({ error: 'Réservé à la direction' });
  const status = req.body?.status;
  if (!['attente', 'valide', 'refuse'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  // Le patron peut trancher payé/non payé au moment de la décision.
  const paid = paidFrom(req, existing.paid);
  // Valider (ou marquer payé) ne doit pas faire passer le solde sous zéro —
  // notamment si le patron bascule une demande « non payé » en « payé » ici.
  if (status !== 'refuse') {
    const check = await canPostLeave(existing.employee_id, {
      type: existing.type, paid, startDate: existing.startDate, endDate: existing.endDate,
      halfDay: existing.halfDay, excludeAbsenceId: req.params.id,
    });
    if (!check.ok) return res.status(400).json({ error: leaveError(check) });
  }
  const { rows } = await query(
    `UPDATE absences SET status = $1, paid = $2 WHERE id = $3${RETURNING}`,
    [status, paid, req.params.id],
  );
  // L'employé est prévenu du verdict (validé / refusé). Fire-and-forget.
  if (status !== 'attente') {
    notifyAbsenceDecided({ absence: rows[0] }).catch((err) => console.error('notifyAbsenceDecided:', err?.message || err));
  }
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
