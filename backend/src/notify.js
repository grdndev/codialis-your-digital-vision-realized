// Notifications RH par email (heures supp, récup, congés/absences).
// Tout est best-effort : on log l'échec, on ne bloque jamais la réponse HTTP.
import { query } from './db.js';
import { sendHrNotifEmail } from './mail.js';

const KIND_LABEL = { sup: 'Heures supplémentaires', recup: 'Récupération' };
const TYPE_LABEL = { tt: 'Télétravail', conge: 'Congé', absence: 'Absence', formation: 'Formation' };

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

function period(startDate, endDate, halfDay) {
  if (!endDate || endDate === startDate) {
    const half = halfDay === 'am' ? ' (matin)' : halfDay === 'pm' ? ' (après-midi)' : '';
    return `le ${fmtDate(startDate)}${half}`;
  }
  return `du ${fmtDate(startDate)} au ${fmtDate(endDate)}`;
}

async function userById(id) {
  const { rows } = await query('SELECT id, name, email, email_verified FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function verifiedPatrons() {
  const { rows } = await query(
    "SELECT name, email FROM users WHERE role = 'patron' AND email_verified IS TRUE",
  );
  return rows;
}

// Fire-and-forget : envoie à chaque destinataire, log les échecs.
function dispatch(recipients, payload) {
  for (const to of recipients) {
    sendHrNotifEmail({ email: to.email, name: to.name, ...payload })
      .catch((err) => console.error(`Notification RH échouée (${to.email}):`, err?.message || err));
  }
}

// Demande d'heures supp / récup créée.
//  - créée par l'employé → tous les patrons (à valider)
//  - créée par le patron pour un employé → l'employé
export async function notifyEntryCreated({ entry, actor }) {
  const kind = KIND_LABEL[entry.kind] || entry.kind;
  const details = [
    ['Type', kind],
    ['Date', fmtDate(entry.date)],
    ['Heures', `${entry.hours} h`],
    ['Motif', entry.motif],
  ];
  const employee = await userById(entry.employeeId);
  if (!employee) return;

  if (actor.id === entry.employeeId) {
    const patrons = await verifiedPatrons();
    dispatch(patrons, {
      subject: `Demande à valider — ${kind} de ${employee.name}`,
      heading: 'Demande à valider',
      intro: `${employee.name} a déclaré une demande de ${kind.toLowerCase()} en attente de votre validation.`,
      details: [['Employé', employee.name], ...details],
      tone: 'amber',
    });
  } else if (employee.email_verified) {
    dispatch([employee], {
      subject: `Nouvelle demande — ${kind}`,
      heading: 'Demande créée pour vous',
      intro: `La direction a déposé une demande de ${kind.toLowerCase()} vous concernant.`,
      details,
      tone: 'green',
    });
  }
}

// Demande d'heures supp / récup validée ou refusée → l'employé.
export async function notifyEntryDecided({ entry }) {
  const employee = await userById(entry.employeeId);
  if (!employee || !employee.email_verified) return;
  const kind = KIND_LABEL[entry.kind] || entry.kind;
  const accepted = entry.status === 'valide';
  dispatch([employee], {
    subject: `${kind} ${accepted ? 'validée' : 'refusée'} — ${fmtDate(entry.date)}`,
    heading: accepted ? 'Demande validée' : 'Demande refusée',
    intro: accepted
      ? `Votre demande de ${kind.toLowerCase()} a été validée par la direction.`
      : `Votre demande de ${kind.toLowerCase()} a été refusée par la direction.`,
    details: [
      ['Type', kind],
      ['Date', fmtDate(entry.date)],
      ['Heures', `${entry.hours} h`],
      ['Motif', entry.motif],
    ],
    tone: accepted ? 'green' : 'red',
  });
}

// Congé / absence créé(e).
//  - demandé par l'employé → tous les patrons (à valider)
//  - posé par le patron (auto-validé) → l'employé
export async function notifyAbsenceCreated({ absence, actor }) {
  const type = TYPE_LABEL[absence.type] || absence.type;
  const when = period(absence.startDate, absence.endDate, absence.halfDay);
  const paidLine = (absence.type === 'conge' || absence.type === 'absence')
    ? [['Décompte', absence.paid === false ? 'Non payé (solde non décompté)' : 'Payé (décompté du solde)']]
    : [];
  const employee = await userById(absence.employeeId);
  if (!employee) return;

  if (actor.id === absence.employeeId) {
    const patrons = await verifiedPatrons();
    dispatch(patrons, {
      subject: `Demande à valider — ${type} de ${employee.name}`,
      heading: 'Demande à valider',
      intro: `${employee.name} a demandé un(e) ${type.toLowerCase()} ${when}, en attente de votre validation.`,
      details: [['Employé', employee.name], ['Type', type], ['Période', when], ['Motif', absence.motif], ...paidLine],
      tone: 'amber',
    });
  } else if (employee.email_verified) {
    dispatch([employee], {
      subject: `${type} ajouté(e) à votre planning — ${when}`,
      heading: 'Planning mis à jour',
      intro: `La direction a posé un(e) ${type.toLowerCase()} ${when} sur votre planning.`,
      details: [['Type', type], ['Période', when], ['Motif', absence.motif], ...paidLine],
      tone: 'green',
    });
  }
}

// Congé / absence validé(e) ou refusé(e) → l'employé.
export async function notifyAbsenceDecided({ absence }) {
  const employee = await userById(absence.employeeId);
  if (!employee || !employee.email_verified) return;
  const type = TYPE_LABEL[absence.type] || absence.type;
  const when = period(absence.startDate, absence.endDate, absence.halfDay);
  const accepted = absence.status === 'valide';
  const paidLine = accepted && (absence.type === 'conge' || absence.type === 'absence')
    ? [['Décompte', absence.paid === false ? 'Non payé (solde non décompté)' : 'Payé (décompté du solde)']]
    : [];
  dispatch([employee], {
    subject: `${type} ${accepted ? 'validé(e)' : 'refusé(e)'} — ${when}`,
    heading: accepted ? 'Demande validée' : 'Demande refusée',
    intro: accepted
      ? `Votre demande (${type.toLowerCase()} ${when}) a été validée par la direction.`
      : `Votre demande (${type.toLowerCase()} ${when}) a été refusée par la direction.`,
    details: [['Type', type], ['Période', when], ['Motif', absence.motif], ...paidLine],
    tone: accepted ? 'green' : 'red',
  });
}

// Règle récurrente posée par la direction (congé/absence sur période, TT
// hebdomadaire…) → l'employé concerné.
export async function notifyRecurrenceCreated({ rule }) {
  const employee = await userById(rule.employeeId);
  if (!employee || !employee.email_verified) return;
  const type = TYPE_LABEL[rule.effect] || rule.effect;
  const when = rule.freq === 'daily'
    ? period(rule.startDate, rule.endDate, rule.halfDay)
    : 'règle récurrente (voir planning)';
  const paidLine = (rule.effect === 'conge' || rule.effect === 'absence')
    ? [['Décompte', rule.paid === false ? 'Non payé (solde non décompté)' : 'Payé (décompté du solde)']]
    : [];
  dispatch([employee], {
    subject: `${type} ajouté(e) à votre planning`,
    heading: 'Planning mis à jour',
    intro: `La direction a posé un(e) ${type.toLowerCase()} (${when}) sur votre planning.`,
    details: [['Type', type], ['Période', when], ['Motif', rule.motif], ...paidLine],
    tone: 'green',
  });
}
