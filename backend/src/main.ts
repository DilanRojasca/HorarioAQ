import 'dotenv/config';
import { config } from './shared/config';
import { assertSafeConfig } from './shared/safeConfig';
import { buildContainer } from './shared/container';
import { EventBus } from './shared/events/EventBus';
import { PrismaEventLog } from './shared/events/PrismaEventLog';
import { registerObservers } from './shared/registerObservers';
import { createApp } from './shared/http/app';
import { startSyncJob } from './jobs/syncJob';
import { startNotificationFlushJob } from './jobs/notificationFlushJob';
import { Argon2Hasher } from './modules/auth/infrastructure/Argon2Hasher';
import { JwtTokenService } from './modules/auth/infrastructure/JwtTokenService';
import { PrismaRevokedTokenRepository } from './modules/auth/infrastructure/PrismaRevokedTokenRepository';
import { PrismaUserRepository } from './modules/auth/infrastructure/PrismaUserRepository';
import { PrismaAuditLog } from './modules/audit/PrismaAuditLog';
import { buildEmailAdapter } from './modules/notifications/infrastructure/buildEmailAdapter';
import { PrismaNotificationRepository } from './modules/notifications/infrastructure/PrismaNotificationRepository';
import { SseHub } from './modules/realtime/SseHub';
import { MockInstitutionalAdapter } from './modules/schedule/infrastructure/MockInstitutionalAdapter';
import { PrismaEnrollmentRepository } from './modules/schedule/infrastructure/PrismaEnrollmentRepository';
import { PrismaScheduleRepository } from './modules/schedule/infrastructure/PrismaScheduleRepository';
import { PrismaSyncRunRepository } from './modules/schedule/infrastructure/PrismaSyncRunRepository';
import { IcsExporter } from './modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from './modules/schedule/infrastructure/exporters/PdfExporter';

export function wire() {
  const eventLog = new PrismaEventLog();
  const bus = new EventBus({ log: eventLog });
  const audit = new PrismaAuditLog();
  const syncRuns = new PrismaSyncRunRepository();
  const notifications = new PrismaNotificationRepository();
  const users = new PrismaUserRepository();
  const hub = new SseHub({ heartbeatMs: config.sseHeartbeatMs });
  const sendWindow = { start: config.notifyWindowStart, end: config.notifyWindowEnd, timeZone: config.notifyTimezone };
  // buildEmailAdapter valida la configuración de correo: lo cubre cualquier camino que llame a wire() (servidor, seed, scripts).
  const email = buildEmailAdapter(config, process.env.NODE_ENV);
  registerObservers(bus, { audit, syncRuns, notifications, users, email, hub, sendWindow });
  const container = buildContainer({
    schedules: new PrismaScheduleRepository(),
    enrollments: new PrismaEnrollmentRepository(),
    institutional: new MockInstitutionalAdapter(syncRuns),
    syncRuns,
    users,
    revoked: new PrismaRevokedTokenRepository(),
    hasher: new Argon2Hasher(),
    tokens: new JwtTokenService(config.jwtSecret),
    audit,
    bus,
    eventLog,
    notifications,
    hub,
    exporters: {
      ics: new IcsExporter({ semesterStart: config.semesterStart, weeks: config.semesterWeeks }),
      pdf: new PdfExporter({ semester: config.semester }),
    },
  }, config);
  return { ...container, bus, sendWindow };
}

if (require.main === module) {
  assertSafeConfig(process.env.NODE_ENV, config.jwtSecret);
  const container = wire();
  const app = createApp(container, config);
  const syncJob = startSyncJob(container, config.syncCron);
  const flushJob = startNotificationFlushJob(
    { notifications: container.notifications, bus: container.bus, window: container.sendWindow },
    config.notifyFlushCron,
  );
  const server = app.listen(config.port, () => console.log(`API en http://localhost:${config.port}/api`));
  // Cierre ordenado: detiene los cron, espera a los observadores en vuelo y termina los streams SSE.
  let shuttingDown = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      if (shuttingDown) return; // una segunda señal no repite el cierre
      shuttingDown = true;
      setTimeout(() => process.exit(1), 10_000).unref(); // salida forzada si algo no termina
      syncJob.stop();
      flushJob.stop();
      void container.bus.idle().finally(() => {
        container.hub.closeAll();
        server.close(() => process.exit(0));
        server.closeIdleConnections();
      });
    });
  }
}
