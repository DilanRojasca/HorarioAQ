import 'dotenv/config';
import { config } from './shared/config';
import { assertSafeConfig } from './shared/safeConfig';
import { buildContainer } from './shared/container';
import { InMemoryEventBus } from './shared/eventBus';
import { createApp } from './shared/http/app';
import { startSyncJob } from './jobs/syncJob';
import { Argon2Hasher } from './modules/auth/infrastructure/Argon2Hasher';
import { JwtTokenService } from './modules/auth/infrastructure/JwtTokenService';
import { PrismaRevokedTokenRepository } from './modules/auth/infrastructure/PrismaRevokedTokenRepository';
import { PrismaUserRepository } from './modules/auth/infrastructure/PrismaUserRepository';
import { PrismaAuditLog } from './modules/audit/PrismaAuditLog';
import { registerAuditListener } from './modules/audit/auditListener';
import { MockInstitutionalAdapter } from './modules/schedule/infrastructure/MockInstitutionalAdapter';
import { PrismaEnrollmentRepository } from './modules/schedule/infrastructure/PrismaEnrollmentRepository';
import { PrismaScheduleRepository } from './modules/schedule/infrastructure/PrismaScheduleRepository';
import { PrismaSyncRunRepository } from './modules/schedule/infrastructure/PrismaSyncRunRepository';
import { IcsExporter } from './modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from './modules/schedule/infrastructure/exporters/PdfExporter';

export function wire() {
  const bus = new InMemoryEventBus();
  const audit = new PrismaAuditLog();
  registerAuditListener(bus, audit);
  const syncRuns = new PrismaSyncRunRepository();
  const container = buildContainer({
    schedules: new PrismaScheduleRepository(),
    enrollments: new PrismaEnrollmentRepository(),
    institutional: new MockInstitutionalAdapter(syncRuns),
    syncRuns,
    users: new PrismaUserRepository(),
    revoked: new PrismaRevokedTokenRepository(),
    hasher: new Argon2Hasher(),
    tokens: new JwtTokenService(config.jwtSecret),
    audit,
    bus,
    exporters: {
      ics: new IcsExporter({ semesterStart: config.semesterStart, weeks: config.semesterWeeks }),
      pdf: new PdfExporter({ semester: config.semester }),
    },
  }, config);
  return { ...container, bus };
}

if (require.main === module) {
  assertSafeConfig(process.env.NODE_ENV, config.jwtSecret);
  const container = wire();
  const app = createApp(container, config);
  startSyncJob(container, config.syncCron);
  app.listen(config.port, () => console.log(`API en http://localhost:${config.port}/api`));
}
