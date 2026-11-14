import cron from 'node-cron';
import { dispatchDue, DispatchDeps, planReminders, ReminderDeps } from '../modules/notifications/application/ScheduledNotifications';

/**
 * Cada minuto: (1) planifica recordatorios de clase (RF-NOT-02) y (2) dispara las notificaciones
 * programadas vencidas, propias o de recordatorio (RF-NOT-01). Es un job, no una petición HTTP:
 * así el trabajo periódico no compite con las respuestas de la API (RNF-01, QA "Uso de recursos").
 */
export function startReminderJob(deps: ReminderDeps & DispatchDeps, expression = '* * * * *') {
  if (!cron.validate(expression)) throw new Error(`REMINDER_CRON inválido: ${expression}`);
  return cron.schedule(expression, () => {
    planReminders(deps).then(() => dispatchDue(deps)).catch((e) => console.error('[reminderJob] falló:', e));
  });
}
