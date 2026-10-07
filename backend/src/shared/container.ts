import { withAudit } from './audit';
import { Config } from './config';
import { AuditPort, EventBus } from './ports';
import { LoginUseCase } from '../modules/auth/application/Login';
import { LogoutUseCase } from '../modules/auth/application/Logout';
import { PasswordHasher, RevokedTokenRepository, TokenService, UserRepository } from '../modules/auth/application/ports';
import { ExportScheduleUseCase, ExportFormat } from '../modules/schedule/application/ExportSchedule';
import { GetSessionDetailUseCase } from '../modules/schedule/application/GetSessionDetail';
import { GetWeeklyScheduleUseCase } from '../modules/schedule/application/GetWeeklySchedule';
import { EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRepository } from '../modules/schedule/application/ports';
import { SyncScheduleUseCase } from '../modules/schedule/application/SyncSchedule';
import { BaseExporter } from '../modules/schedule/infrastructure/exporters/BaseExporter';

export interface Ports {
  schedules: ScheduleRepository;
  enrollments: EnrollmentRepository;
  institutional: InstitutionalPort;
  syncRuns: SyncRunRepository;
  users: UserRepository;
  revoked: RevokedTokenRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  audit: AuditPort;
  bus: EventBus;
  exporters: Record<ExportFormat, BaseExporter>;
}

export function buildContainer(p: Ports, cfg: Config) {
  const weekly = new GetWeeklyScheduleUseCase(p.schedules, p.enrollments, cfg.semester);

  const getWeekly = withAudit(p.audit, 'VIEW_THIRD_PARTY_SCHEDULE', weekly, {
    entity: 'schedule',
    actorOf: (i) => i.requesterId,
    shouldAudit: (i) => !!i.targetUserId && i.targetUserId !== i.requesterId,
    detailOf: (i) => ({ targetUserId: i.targetUserId }),
  });

  const getDetail = withAudit(p.audit, 'VIEW_THIRD_PARTY_SESSION', new GetSessionDetailUseCase(p.schedules), {
    entity: 'schedule',
    actorOf: (i) => i.requesterId,
    shouldAudit: (i) => !!i.ownerId && i.ownerId !== i.requesterId,
    detailOf: (i) => ({ ownerId: i.ownerId, externalId: i.externalId }),
  });

  const sync = withAudit(
    p.audit, 'SYNC',
    new SyncScheduleUseCase(
      { schedules: p.schedules, enrollments: p.enrollments, institutional: p.institutional, syncRuns: p.syncRuns, bus: p.bus },
      { semester: cfg.semester, concurrency: cfg.syncConcurrency },
    ),
    { entity: 'schedule', actorOf: (i) => i.actorId ?? 'system', detailOf: (i, o) => ({ trigger: i.trigger, ...o }), auditFailures: true },
  );

  return {
    login: new LoginUseCase(p.users, p.hasher, p.tokens),
    logout: new LogoutUseCase(p.revoked),
    getWeekly,
    getDetail,
    exportSchedule: new ExportScheduleUseCase(weekly, p.users, p.exporters),
    sync,
    syncRuns: p.syncRuns,
    tokens: p.tokens,
    revoked: p.revoked,
  };
}
export type Container = ReturnType<typeof buildContainer>;
