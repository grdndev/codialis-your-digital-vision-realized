// Envoi automatique du récapitulatif mensuel.
// Chaque 1er du mois à 08:00 (Europe/Paris) :
//   - la direction (patron) reçoit le récap PDF de toute l'équipe.
// Les récaps individuels (employé / chef) ne sont plus envoyés par email pour
// réduire les notifications — ils restent consultables dans l'application.
// Le PDF est généré côté serveur (voir recap.js) et joint à l'email (Brevo).
import cron from 'node-cron';
import { query } from './db.js';
import { monthPeriod, buildTeamRecapPdf } from './recap.js';
import { sendMonthlyRecapEmail } from './mail.js';

// Mois précédent (celui qui vient de se terminer) par rapport à `ref`.
function previousMonth(ref = new Date()) {
  let year = ref.getFullYear();
  let month0 = ref.getMonth() - 1;
  if (month0 < 0) { month0 = 11; year -= 1; }
  return { year, month0 };
}

// Exécute l'envoi pour un mois donné (défaut : le mois précédent). Best-effort :
// un échec d'envoi n'interrompt pas les autres. Renvoie un récap des résultats.
export async function runMonthlyRecap({ year, month0, dryRun = false, onlyEmail = null } = {}) {
  const pm = (year != null && month0 != null) ? { year, month0 } : previousMonth();
  const period = monthPeriod(pm.year, pm.month0);
  const result = { period: period.label, dryRun, sent: 0, failed: 0, errors: [] };

  const { rows: allUsers } = await query(
    `SELECT id, name, email, role FROM users WHERE email_verified IS TRUE ORDER BY role DESC, name ASC`,
  );
  // onlyEmail : ne cible qu'un destinataire (test sans spammer toute l'équipe).
  const users = onlyEmail ? allUsers.filter((u) => u.email === onlyEmail) : allUsers;

  // 1) Récap individuel (employés + chefs) : désactivé pour réduire les
  //    notifications. Le récap reste consultable dans l'application ; seul le
  //    récap équipe automatique (patron) est envoyé par email ci-dessous.

  // 2) Récap équipe : envoyé à chaque patron (généré une seule fois).
  const patrons = users.filter((x) => x.role === 'patron');
  if (patrons.length) {
    try {
      const teamPdf = await buildTeamRecapPdf(period);
      for (const p of patrons) {
        try {
          if (!dryRun) await sendMonthlyRecapEmail({ email: p.email, name: p.name, periodLabel: period.label, pdf: teamPdf, isTeam: true });
          result.sent += 1;
        } catch (err) {
          result.failed += 1;
          result.errors.push(`${p.email}: ${err?.message || err}`);
          console.error('recap mensuel (équipe) échec pour', p.email, err?.message || err);
        }
      }
    } catch (err) {
      result.failed += 1;
      result.errors.push(`équipe: ${err?.message || err}`);
      console.error('recap mensuel équipe — génération échouée:', err?.message || err);
    }
  }

  console.log(`Récap mensuel ${period.label} : ${result.sent} envoyé(s), ${result.failed} échec(s).`);
  return result;
}

// Démarre la planification (idempotent : une seule tâche cron).
let scheduled = false;
export function startRecapScheduler() {
  if (scheduled) return;
  scheduled = true;
  // « 0 8 1 * * » = à 08:00, le 1er de chaque mois.
  cron.schedule('0 8 1 * *', () => {
    runMonthlyRecap().catch((err) => console.error('runMonthlyRecap:', err?.message || err));
  }, { timezone: 'Europe/Paris' });
  console.log('Planificateur récap mensuel actif (1er du mois, 08:00 Europe/Paris).');
}
