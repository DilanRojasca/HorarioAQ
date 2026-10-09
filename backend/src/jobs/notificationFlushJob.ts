import cron from 'node-cron';
import { flushPendingEmails, FlushDeps } from '../modules/notifications/application/flushPendingEmails';

/** Reintenta periódicamente los correos que quedaron pendientes (p. ej. por estar fuera de la ventana de envío). */
export function startNotificationFlushJob(deps: FlushDeps, expression: string) {
  if (!cron.validate(expression)) throw new Error(`NOTIFY_FLUSH_CRON inválido: ${expression}`);
  return cron.schedule(expression, () => {
    flushPendingEmails(deps).catch((e) => console.error('[notificationFlushJob] falló:', e));
  });
}
