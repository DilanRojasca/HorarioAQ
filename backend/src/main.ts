import 'dotenv/config';
import { config } from './shared/config';
import { assertSafeConfig } from './shared/safeConfig';
import { assertSafeEmailConfig } from './shared/safeEmailConfig';
import { buildContainer } from './shared/container';
import { EventBus } from './shared/events/EventBus';
import { PrismaEventLog } from './shared/events/PrismaEventLog';
import { createApp } from './shared/http/app';
import { startSyncJob } from './jobs/syncJob';
import { startNotificationFlushJob } from './jobs/notificationFlushJob';
import { Argon2Hasher } from './modules/auth/infrastructure/Argon2Hasher';
import { JwtTokenService } from './modules/auth/infrastructure/JwtTokenService';
import { PrismaRevokedTokenRepository } from './modules/auth/infrastructure/PrismaRevokedTokenRepository';
import { PrismaUserRepository } from './modules/auth/infrastructure/PrismaUserRepository';
import { PrismaAuditLog } from './modules/audit/PrismaAuditLog';
import { registerEmailObserver } from './modules/notifications/application/EmailObserver';
import { buildEmailAdapter } from './modules/notifications/infrastructure/buildEmailAdapter';
import { registerNotificationObserver } from './modules/notifications/application/NotificationObserver';
import { PrismaNotificationRepository } from './modules/notifications/infrastructure/PrismaNotificationRepository';
import { SseHub } from './modules/realtime/SseHub';
import { registerRealtimeObserver } from './modules/realtime/RealtimeObserver';
import { registerAuditObserver } from './modules/audit/auditObserver';
import { registerSyncStatsObserver } from './modules/schedule/observers/syncStatsObserver';
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
  registerAuditObserver(bus, audit);
  const syncRuns = new PrismaSyncRunRepository();
  registerSyncStatsObserver(bus, syncRuns);
  const notifications = new PrismaNotificationRepository();
  registerNotificationObserver(bus, notifications);
  const users = new PrismaUserRepository();
  const window = { start: config.notifyWindowStart, end: config.notifyWindowEnd, timeZone: config.notifyTimezone };
  registerEmailObserver({ bus, notifications, users, email: buildEmailAdapter(config), window });
  const hub = new SseHub({ heartbeatMs: config.sseHeartbeatMs });
  registerRealtimeObserver(bus, hub, { window });
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
  return { ...container, bus, window };
}

if (require.main === module) {
  assertSafeConfig(process.env.NODE_ENV, config.jwtSecret);
  assertSafeEmailConfig(config, process.env.NODE_ENV);
  const container = wire();
  const app = createApp(container, config);
  startSyncJob(container, config.syncCron);
  startNotificationFlushJob(
    { notifications: container.notifications, bus: container.bus, window: container.window },
    config.notifyFlushCron,
  );
  const server = app.listen(config.port, () => console.log(`API en http://localhost:${config.port}/api`));
  // Cierre ordenado: termina los streams SSE para que el servidor pueda cerrar.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      container.hub.closeAll();
      server.close(() => process.exit(0));
      server.closeIdleConnections();
    });
  }
}
