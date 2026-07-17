// Génération SERVEUR des récapitulatifs PDF (mêmes données/rendu que l'app
// admin, qui les produit côté navigateur avec jsPDF). Utilisé par l'envoi
// mensuel automatique (voir recap-cron.js) : le PDF est attaché à l'email.
//
// jsPDF fonctionne en Node (sortie ArrayBuffer -> Buffer). autoTable est
// enregistré par l'import à effet de bord ci-dessous.
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { query } from './db.js';
import { leaveDaysInRange, isHoliday, availableHours, availableLeave } from './balances.js';

// ---- Dates ----
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseIso(s) { const p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
const MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MON_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
function fmtLong(d) { return pad2(d.getDate()) + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
const ATYPE_LABEL = { tt: 'Télétravail', conge: 'Congé', absence: 'Absent', formation: 'Formation' };
const STATUS_LABEL = { attente: 'En attente', valide: 'Validé', refuse: 'Refusé' };

// Slug de nom de fichier : minuscules, sans accents ni espaces.
function slug(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recap';
}

// Bornes ISO + libellé d'un mois (0-indexé) d'une année.
export function monthPeriod(year, month0) {
  const last = new Date(year, month0 + 1, 0).getDate();
  const m = pad2(month0 + 1);
  return { start: year + '-' + m + '-01', end: year + '-' + m + '-' + pad2(last), label: MON_FULL[month0] + ' ' + year };
}

// ---- Règles récurrentes (miroir du front) ----
function weeksBetween(startIso, d) {
  if (!startIso) return 0;
  const a = parseIso(startIso);
  return Math.floor((d - a) / (7 * 86400000));
}
function recurrenceMatches(r, d) {
  const iso = isoOf(d);
  if (r.startDate && iso < r.startDate) return false;
  if (r.endDate && iso > r.endDate) return false;
  const wd = (d.getDay() + 6) % 7;
  if (r.freq === 'daily') return wd < 5;
  if (r.freq === 'weekly') return wd === r.weekday;
  if (r.freq === 'biweekly') return wd === r.weekday && (weeksBetween(r.startDate, d) % 2 === 0);
  if (r.freq === 'monthly') return d.getDate() === r.monthday;
  return false;
}
function absenceCovers(a, d) { const iso = isoOf(d); return iso >= a.startDate && iso <= a.endDate; }

// Charge toutes les données HR d'un employé (tout historique — les calculs de
// solde ont besoin des données hors période).
async function loadEmployeeData(empId) {
  const [entries, absences, recurrences, presence] = await Promise.all([
    query(`SELECT kind, to_char(entry_date,'YYYY-MM-DD') AS date, hours::float AS hours, motif, status, paid FROM entries WHERE employee_id = $1`, [empId]),
    query(`SELECT type, to_char(start_date,'YYYY-MM-DD') AS "startDate", to_char(end_date,'YYYY-MM-DD') AS "endDate", half_day AS "halfDay", motif, status, paid FROM absences WHERE employee_id = $1`, [empId]),
    query(`SELECT effect, freq, weekday, monthday, half_day AS "halfDay", to_char(start_date,'YYYY-MM-DD') AS "startDate", to_char(end_date,'YYYY-MM-DD') AS "endDate", paid FROM recurrences WHERE employee_id = $1`, [empId]),
    query(`SELECT to_char(day,'YYYY-MM-DD') AS day, status FROM presence WHERE employee_id = $1`, [empId]),
  ]);
  const presMap = {};
  presence.rows.forEach((p) => { presMap[p.day] = p.status; });
  return { entries: entries.rows, absences: absences.rows, recurrences: recurrences.rows, presence: presMap };
}

// Catégorie d'un jour ouvré (même priorité que le planning). null = week-end.
function dayCategory(data, d) {
  const wd = (d.getDay() + 6) % 7;
  if (wd >= 5) return null;
  const iso = isoOf(d);
  const abs = data.absences.find((a) => a.status !== 'refuse' && absenceCovers(a, d));
  if (abs) return abs.type;
  const rec = data.entries.find((e) => e.kind === 'recup' && e.date === iso && e.status !== 'refuse');
  if (rec) return 'recup';
  const p = data.presence[iso];
  if (p === 'present' || p === 'tt' || p === 'conge') return p;
  const rule = data.recurrences.find((r) => recurrenceMatches(r, d));
  if (rule) return rule.effect;
  if (isHoliday(iso)) return 'ferie';
  return 'present';
}
function presenceCounts(data, startIso, endIso) {
  const c = { present: 0, tt: 0, conge: 0, formation: 0, absence: 0, recup: 0, ferie: 0 };
  let d = parseIso(startIso); const end = parseIso(endIso);
  while (d <= end) { const k = dayCategory(data, d); if (k && c[k] != null) c[k] += 1; d = addDays(d, 1); }
  return c;
}
function entrySums(data, startIso, endIso) {
  const es = data.entries.filter((e) => e.date >= startIso && e.date <= endIso && e.status !== 'refuse');
  const sup = es.filter((e) => e.kind === 'sup');
  const supPaid = sup.filter((e) => e.paid === true).reduce((a, e) => a + (parseFloat(e.hours) || 0), 0);
  const supRecup = sup.filter((e) => e.paid !== true).reduce((a, e) => a + (parseFloat(e.hours) || 0), 0);
  const recup = es.filter((e) => e.kind === 'recup').reduce((a, e) => a + (parseFloat(e.hours) || 0), 0);
  return { sup: round2(supPaid + supRecup), supPaid: round2(supPaid), supRecup: round2(supRecup), recup: round2(recup) };
}
function leaveTaken(data, startIso, endIso) {
  let taken = 0;
  for (const a of data.absences) {
    if (a.status === 'refuse' || a.paid === false) continue;
    if (a.type !== 'conge' && a.type !== 'absence') continue;
    const s = a.startDate > startIso ? a.startDate : startIso;
    const e = a.endDate < endIso ? a.endDate : endIso;
    if (s > e) continue;
    const hd = a.startDate === a.endDate ? a.halfDay : null;
    taken += leaveDaysInRange(s, e, hd, null);
  }
  for (const r of data.recurrences) {
    if (r.paid === false || r.freq !== 'daily') continue;
    if (r.effect !== 'conge' && r.effect !== 'absence') continue;
    const rEnd = r.endDate || endIso;
    const s = r.startDate > startIso ? r.startDate : startIso;
    const e = rEnd < endIso ? rEnd : endIso;
    if (!s || s > e) continue;
    taken += leaveDaysInRange(s, e, null, null);
  }
  return round2(taken);
}

const GREEN = { fillColor: [47, 237, 127], textColor: [8, 17, 30] };
function header(doc, title, subtitle, M) {
  doc.setFillColor(47, 237, 127); doc.rect(M, 34, 4, 22, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 24, 32);
  doc.text(title, M + 14, 50);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(90, 100, 115);
  doc.text(subtitle, M + 14, 68);
  doc.setFontSize(9); doc.setTextColor(140, 150, 165);
  doc.text('Codialis · document généré le ' + fmtLong(new Date()), M + 14, 84);
  return 108;
}

// ----- PDF d'un employé. `includeRefused` : garde les demandes refusées
// (recap perso complet) ; sinon on les exclut (recap officiel/direction). -----
export async function buildEmployeeRecapPdf(user, period, { includeRefused = true } = {}) {
  const data = await loadEmployeeData(user.id);
  const sums = entrySums(data, period.start, period.end);
  const taken = leaveTaken(data, period.start, period.end);
  const c = presenceCounts(data, period.start, period.end);
  const hb = await availableHours(user.id);
  const lv = await availableLeave(user.id);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  let y = header(doc, 'Récapitulatif — ' + user.name, period.label, M);

  doc.autoTable({
    startY: y,
    head: [['Synthèse — ' + period.label, '']],
    body: [
      ['Heures supp. mises en récup', sums.supRecup + ' h'],
      ['Heures supp. payées (paie)', sums.supPaid + ' h'],
      ['Total heures supplémentaires', sums.sup + ' h'],
      ['Heures de récupération prises', sums.recup + ' h'],
      ['Congés / absences pris (payés)', taken + ' j'],
      ['Jours présents', String(c.present)],
      ['Télétravail (jours)', String(c.tt)],
      ['Congé (jours)', String(c.conge)],
      ['Formation (jours)', String(c.formation)],
      ['Absent (jours)', String(c.absence)],
      ['Récupérations (jours)', String(c.recup)],
      ['Jours fériés (ouvrés)', String(c.ferie)],
      ['Solde d’heures (actuel)', (hb.defined ? hb.available : 0) + ' h'],
      ['Solde de congés (actuel)', lv.defined ? (lv.available + ' j') : 'non défini'],
    ],
    theme: 'grid', styles: { fontSize: 10, cellPadding: 5 }, headStyles: GREEN,
    columnStyles: { 0: { cellWidth: 320 }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 22;

  const eRows = data.entries
    .filter((e) => (includeRefused || e.status !== 'refuse') && e.date >= period.start && e.date <= period.end)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((e) => [
      fmtLong(parseIso(e.date)),
      e.kind === 'sup' ? 'Heures supp' : 'Récup',
      round2(e.hours) + ' h',
      e.kind === 'sup' ? (e.paid === true ? 'Payée' : 'Récup') : '—',
      STATUS_LABEL[e.status] || e.status, e.motif || '',
    ]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20, 24, 32);
  doc.text('Heures supplémentaires & récupérations', M, y); y += 8;
  if (eRows.length) {
    doc.autoTable({ startY: y, head: [['Date', 'Type', 'Heures', 'Traitement', 'Statut', 'Motif']], body: eRows, theme: 'striped', styles: { fontSize: 9, cellPadding: 4 }, headStyles: GREEN, columnStyles: { 2: { halign: 'right' } }, margin: { left: M, right: M } });
    y = doc.lastAutoTable.finalY + 22;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120, 130, 145);
    y += 14; doc.text('Aucune heure déclarée sur la période.', M, y); y += 18;
  }

  const aRows = data.absences
    .filter((a) => (includeRefused || a.status !== 'refuse') && a.startDate <= period.end && a.endDate >= period.start)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
    .map((a) => {
      const label = ATYPE_LABEL[a.type] || a.type;
      const half = a.startDate === a.endDate ? (a.halfDay === 'am' ? 'Matin' : a.halfDay === 'pm' ? 'Après-midi' : 'Journée') : '';
      const s = a.startDate > period.start ? a.startDate : period.start;
      const e = a.endDate < period.end ? a.endDate : period.end;
      const hd = a.startDate === a.endDate ? a.halfDay : null;
      return [label, fmtLong(parseIso(a.startDate)), fmtLong(parseIso(a.endDate)), half, a.paid === false ? 'Non payé' : 'Payé', STATUS_LABEL[a.status] || a.status, leaveDaysInRange(s, e, hd, null) + ' j'];
    });
  if (y > 700) { doc.addPage(); y = 50; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20, 24, 32);
  doc.text('Congés & absences', M, y); y += 8;
  if (aRows.length) {
    doc.autoTable({ startY: y, head: [['Type', 'Début', 'Fin', 'Durée', 'Paie', 'Statut', 'Jours ouvrés']], body: aRows, theme: 'striped', styles: { fontSize: 9, cellPadding: 4 }, headStyles: GREEN, columnStyles: { 6: { halign: 'right' } }, margin: { left: M, right: M } });
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120, 130, 145);
    y += 14; doc.text('Aucun congé ni absence sur la période.', M, y);
  }

  return { buffer: Buffer.from(doc.output('arraybuffer')), filename: 'recap-' + slug(user.name) + '-' + slug(period.label) + '.pdf' };
}

// ----- PDF récap équipe (une ligne par employé) pour la direction. -----
export async function buildTeamRecapPdf(period) {
  const { rows: employees } = await query(
    `SELECT id, name FROM users WHERE role = 'employe' ORDER BY name ASC`,
  );
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const M = 36;
  const y = header(doc, 'Récapitulatif RH — équipe', period.label, M);

  const body = [];
  for (const a of employees) {
    const data = await loadEmployeeData(a.id);
    const sums = entrySums(data, period.start, period.end);
    const taken = leaveTaken(data, period.start, period.end);
    const c = presenceCounts(data, period.start, period.end);
    const hb = await availableHours(a.id);
    const lv = await availableLeave(a.id);
    body.push([
      a.name, sums.supRecup + ' h', sums.supPaid + ' h', sums.recup + ' h', taken + ' j',
      String(c.present), String(c.tt), String(c.formation), String(c.absence),
      (hb.defined ? hb.available : 0) + ' h', lv.defined ? (lv.available + ' j') : '—',
    ]);
  }
  if (!body.length) body.push(['Aucun employé', '', '', '', '', '', '', '', '', '', '']);
  doc.autoTable({
    startY: y,
    head: [['Employé', 'Sup récup', 'Sup payées', 'Récup', 'Congés', 'Présents', 'TT', 'Formation', 'Absent', 'Solde h', 'Solde congés']],
    body, theme: 'grid', styles: { fontSize: 9, cellPadding: 5 }, headStyles: GREEN,
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' } },
    margin: { left: M, right: M },
  });
  const fy = doc.lastAutoTable.finalY + 18;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(130, 140, 155);
  doc.text('Sup récup / Sup payées / Récup / Congés : cumul sur la période. Solde h / Solde congés : valeurs actuelles.', M, fy);

  return { buffer: Buffer.from(doc.output('arraybuffer')), filename: 'recap-equipe-' + slug(period.label) + '.pdf' };
}
