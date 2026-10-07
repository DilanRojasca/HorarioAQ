import cron from 'node-cron';
import { Container } from '../shared/container';

/** Sincronización masiva periódica; por defecto 03:00 (baja demanda). */
export function startSyncJob(c: Container, expression: string) {
  if (!cron.validate(expression)) throw new Error(`SYNC_CRON inválido: ${expression}`);
  return cron.schedule(expression, () => {
    c.sync.execute({ trigger: 'CRON' }).catch((e) => console.error('[syncJob] falló:', e));
  });
}
