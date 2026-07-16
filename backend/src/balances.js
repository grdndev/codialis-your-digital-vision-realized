// Calcul des soldes côté serveur (source de vérité) + garde anti-négatif.
// Le solde d'un employé ne doit JAMAIS pouvoir descendre sous zéro : toute
// demande (récup, congé/absence payé) qui dépasserait le disponible est
// refusée à la pose. Les demandes en attente « réservent » déjà leur montant
// pour empêcher l'empilement de plusieurs demandes qui, cumulées, passeraient
// en négatif.
import { query } from './db.js';

// ---- Dates : jours ouvrés (lun-ven) hors jours fériés France ----
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseIso(s) { const p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
const HOLIDAY_CACHE = {};
function frenchHolidays(year) {
  if (HOLIDAY_CACHE[year]) return HOLIDAY_CACHE[year];
  const map = {};
  const add = (d) => { map[isoOf(d)] = true; };
  add(new Date(year, 0, 1)); add(new Date(year, 4, 1)); add(new Date(year, 4, 8));
  add(new Date(year, 6, 14)); add(new Date(year, 7, 15)); add(new Date(year, 10, 1));
  add(new Date(year, 10, 11)); add(new Date(year, 11, 25));
  const easter = easterSunday(year);
  add(addDays(easter, 1)); add(addDays(easter, 39)); add(addDays(easter, 50));
  HOLIDAY_CACHE[year] = map;
  return map;
}
function isHoliday(iso) {
  const y = Number(String(iso).slice(0, 4));
  return y ? !!frenchHolidays(y)[iso] : false;
}

// Jours ouvrés (lun-ven, hors fériés) de la plage inclusive [start..end], en ne
// comptant que ceux STRICTEMENT après `afterIso` (l'ancre). Demi-journée = 0,5.
export function leaveDaysInRange(startIso, endIso, halfDay, afterIso) {
  if (!startIso) return 0;
  let d = parseIso(startIso);
  const end = parseIso(endIso || startIso);
  let total = 0;
  while (d <= end) {
    const iso = isoOf(d);
    const wd = (d.getDay() + 6) % 7;
    if ((!afterIso || iso > afterIso) && wd < 5 && !isHoliday(iso)) total += 1;
    d = addDays(d, 1);
  }
  return halfDay ? total * 0.5 : total;
}

// Mois complets écoulés entre deux dates ISO (accrual +2,5 j/mois).
function monthsBetweenIso(fromIso, toIso) {
  if (!fromIso || !toIso || toIso <= fromIso) return 0;
  const a = parseIso(fromIso), b = parseIso(toIso);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

function todayIso() { return isoOf(new Date()); }

// ---------------------------------------------------------------------------
// HEURES SUP / RÉCUP
// disponible = base ancrée + heures sup VALIDÉES − récups (attente + validées),
// en excluant éventuellement une entrée (`excludeId`, utile à la validation).
// Les récups en attente réservent leur montant ; les heures sup en attente ne
// sont PAS comptées comme disponibles (prudence : elles ne sont pas acquises).
export async function availableHours(employeeId, excludeId = null) {
  const { rows: urows } = await query(
    'SELECT hours_balance::float AS base, to_char(hours_anchor, \'YYYY-MM-DD\') AS anchor FROM users WHERE id = $1',
    [employeeId],
  );
  if (urows.length === 0) return { defined: false, available: 0 };
  const base = urows[0].base != null ? urows[0].base : 0;
  const anchor = urows[0].anchor; // peut être null (comportement historique)

  const { rows } = await query(
    `SELECT kind, status, hours::float AS hours, to_char(entry_date, 'YYYY-MM-DD') AS date
     FROM entries WHERE employee_id = $1 AND ($2::uuid IS NULL OR id <> $2)`,
    [employeeId, excludeId],
  );
  let avail = base;
  for (const e of rows) {
    if (anchor && e.date <= anchor) continue;
    if (e.kind === 'sup' && e.status === 'valide') avail += e.hours;
    else if (e.kind === 'recup' && e.status !== 'refuse') avail -= e.hours;
  }
  return { defined: true, available: Math.round(avail * 100) / 100 };
}

// La récup de `hours` heures est-elle possible sans passer sous zéro ?
export async function canSpendHours(employeeId, hours, excludeId = null) {
  const { available } = await availableHours(employeeId, excludeId);
  // Tolérance flottante d'un centième d'heure.
  return hours <= available + 0.001;
}

// ---------------------------------------------------------------------------
// CONGÉS
// base = solde saisi + 2,5 j / mois complet depuis l'ancre.
// consommé = jours ouvrés des congés/absences PAYÉS (attente + validés) postés
//            après l'ancre + règles récurrentes « daily » payées (congé/absence).
// disponible = base − consommé. Non défini si le patron n'a jamais saisi de solde.
export async function availableLeave(employeeId, excludeAbsenceId = null) {
  const { rows: urows } = await query(
    'SELECT leave_balance::float AS base, to_char(leave_anchor, \'YYYY-MM-DD\') AS anchor FROM users WHERE id = $1',
    [employeeId],
  );
  if (urows.length === 0 || urows[0].base == null || !urows[0].anchor) return { defined: false, available: 0 };
  const anchor = urows[0].anchor;
  const today = todayIso();
  let avail = urows[0].base + monthsBetweenIso(anchor, today) * 2.5;

  const { rows: abs } = await query(
    `SELECT type, status, paid, half_day AS "halfDay",
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date,   'YYYY-MM-DD') AS "endDate"
     FROM absences
     WHERE employee_id = $1 AND ($2::uuid IS NULL OR id <> $2)`,
    [employeeId, excludeAbsenceId],
  );
  for (const a of abs) {
    if (a.status === 'refuse' || a.paid === false) continue;
    if (a.type !== 'conge' && a.type !== 'absence') continue;
    avail -= leaveDaysInRange(a.startDate, a.endDate, a.halfDay, anchor);
  }

  const { rows: rec } = await query(
    `SELECT effect, paid, half_day AS "halfDay",
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date,   'YYYY-MM-DD') AS "endDate"
     FROM recurrences WHERE employee_id = $1 AND freq = 'daily'`,
    [employeeId],
  );
  for (const r of rec) {
    if (r.paid === false) continue;
    if (r.effect !== 'conge' && r.effect !== 'absence') continue;
    // Un congé/absence planifié réserve son solde en entier, y compris pour des
    // jours à venir (comme une demande d'absence). On prend donc la date de fin
    // réelle de la règle ; à défaut (règle sans fin) on borne à aujourd'hui pour
    // ne pas décompter un futur infini. Cohérent avec la garde anti-négatif à la
    // pose (voir routes/recurrences.js), qui chiffre déjà `endDate || today`.
    const end = r.endDate || today;
    if (r.startDate && r.startDate > end) continue;
    avail -= leaveDaysInRange(r.startDate, end, r.halfDay, anchor);
  }
  return { defined: true, available: Math.round(avail * 100) / 100 };
}

// L'ancre de congés d'un employé (null si jamais saisie).
async function leaveAnchor(employeeId) {
  const { rows } = await query(
    'SELECT to_char(leave_anchor, \'YYYY-MM-DD\') AS anchor FROM users WHERE id = $1',
    [employeeId],
  );
  return rows.length ? rows[0].anchor : null;
}

// Un congé/absence payé sur [startDate..endDate] est-il posable sans passer le
// solde sous zéro ? `excludeAbsenceId` : ignore une absence existante (édition /
// validation). Ne s'applique qu'aux types conge/absence payés ; sinon toujours
// ok. Sans solde défini, aucune limite.
export async function canPostLeave(employeeId, { type, paid, startDate, endDate, halfDay, excludeAbsenceId = null }) {
  if (paid === false || (type !== 'conge' && type !== 'absence')) return { ok: true };
  const { defined, available } = await availableLeave(employeeId, excludeAbsenceId);
  if (!defined) return { ok: true };
  const anchor = await leaveAnchor(employeeId);
  const cost = leaveDaysInRange(startDate, endDate, halfDay, anchor);
  return { ok: cost <= available + 0.001, available, cost };
}
