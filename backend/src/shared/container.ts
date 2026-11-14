import { withAudit } from './audit';
import { Config } from './config';
import { EventBus } from './events/EventBus';
import { EventLog } from './events/types';
import { AuditPort, AuditReader } from './ports';
import { SseHub } from '../modules/realtime/SseHub';
import { ChangeUserRoleUseCase, ListUsersUseCase } from '../modules/auth/application/ManageUsers';
import { OtpService } from '../modules/auth/application/OtpService';
import { RefreshTokenService } from '../modules/auth/application/RefreshTokenService';
import { RegisterUseCase } from '../modules/auth/application/Register';
import { RequestPasswordResetUseCase, ResetPasswordUseCase } from '../modules/auth/application/PasswordReset';
import { GetProfileUseCase, UpdatePreferencesUseCase, UpdateProfileUseCase } from '../modules/auth/application/UpdateProfile';
import { ResendVerificationUseCase, VerifyAccountUseCase } from '../modules/auth/application/VerifyAccount';
import { OtpCodec, OtpMailer, OtpRepository, RefreshTokenRepository } from '../modules/auth/application/ports';
import { CatalogRepository, CreateFacultyUseCase, CreateProgramUseCase, DeleteProgramUseCase, ListCatalogUseCase, UpdateProgramUseCase } from '../modules/catalog/application/CatalogUseCases';
import { CreateActivityUseCase, GapService, ListActivitiesUseCase, ListGapsUseCase, RemoveActivityUseCase, SetGapStatusUseCase, UpdateActivityUseCase } from '../modules/gaps/application/GapUseCases';
import { GapRepository } from '../modules/gaps/application/ports';
import { CancelScheduledUseCase, CreateCustomNotificationUseCase, ListScheduledUseCase } from '../modules/notifications/application/ScheduledNotifications';
import { ScheduledNotificationRepository } from '../modules/notifications/application/ports';
import { LoginUseCase } from '../modules/auth/application/Login';
import { LogoutUseCase } from '../modules/auth/application/Logout';
import { NotificationRepository } from '../modules/notifications/application/ports';
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
  eventLog: EventLog;
  notifications: NotificationRepository;
  hub: SseHub;
  otps: OtpRepository;
  refreshTokens: RefreshTokenRepository;
  otpCodec: OtpCodec;
  otpMailer: OtpMailer;
  gaps: GapRepository;
  catalog: CatalogRepository;
  scheduled: ScheduledNotificationRepository;
  auditReader: AuditReader;
  exporters: Record<ExportFormat, BaseExporter>;
}

/** @pattern Dependency Injection | Composition Root | Recibe los puertos ya construidos y devuelve los casos de uso listos. */
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

  const refresh = new RefreshTokenService(p.refreshTokens, p.users, p.tokens);
  const otp = new OtpService(p.otps, p.otpCodec, p.otpMailer);
  const gapService = new GapService(p.schedules, p.enrollments, p.gaps, cfg.semester);
  const actor = <I extends { actorId: string }>(a: string) => ({ entity: a, actorOf: (i: I) => i.actorId });

  // DECORATOR: la auditoría transversal envuelve a los casos de uso sin que ellos la conozcan (RNF-14).
  const login = withAudit(p.audit, 'LOGIN', new LoginUseCase(p.users, p.hasher, p.tokens, refresh), {
    entity: 'auth', actorOf: () => undefined, actorOfOutput: (o) => o.user.id, detailOf: (i) => ({ email: i.email }), auditFailures: true,
  });
  const register = withAudit(p.audit, 'REGISTER', new RegisterUseCase(p.users, p.hasher, otp), {
    entity: 'user', actorOf: () => undefined, detailOf: (i) => ({ email: i.email.trim().toLowerCase() }),
  });
  const verifyAccount = withAudit(p.audit, 'VERIFY_ACCOUNT', new VerifyAccountUseCase(p.users, otp), {
    entity: 'user', actorOf: () => undefined, detailOf: (i) => ({ email: i.email.trim().toLowerCase() }),
  });
  const resetPassword = withAudit(p.audit, 'PASSWORD_RESET', new ResetPasswordUseCase(p.users, p.hasher, otp, refresh), {
    entity: 'user', actorOf: () => undefined, detailOf: (i) => ({ email: i.email.trim().toLowerCase() }),
  });
  const updateProfile = withAudit(p.audit, 'UPDATE_PROFILE', new UpdateProfileUseCase(p.users, p.hasher, refresh), {
    entity: 'user', actorOf: (i) => i.userId, detailOf: (i) => ({ name: i.name !== undefined, avatar: i.avatarUrl !== undefined, password: i.newPassword !== undefined }),
  });
  const changeRole = withAudit(p.audit, 'CHANGE_ROLE', new ChangeUserRoleUseCase(p.users), {
    ...actor<{ actorId: string; userId: string; role: 'STUDENT' | 'ADMIN' }>('user'), detailOf: (i) => ({ userId: i.userId, role: i.role }),
  });
  const catalogAudit = <I extends { actorId: string }, O>(action: string, inner: { execute(i: Omit<I, 'actorId'>): Promise<O> }) =>
    withAudit<I, O>(p.audit, action, inner as { execute(i: I): Promise<O> }, { ...actor<I>('catalog'), detailOf: (i) => { const { actorId: _a, ...rest } = i; return rest; } });

  return {
    login,
    refresh,
    register,
    verifyAccount,
    resendVerification: new ResendVerificationUseCase(p.users, otp),
    requestPasswordReset: new RequestPasswordResetUseCase(p.users, otp),
    resetPassword,
    getProfile: new GetProfileUseCase(p.users),
    updateProfile,
    updatePreferences: new UpdatePreferencesUseCase(p.users),
    listUsers: new ListUsersUseCase(p.users),
    changeRole,
    listGaps: new ListGapsUseCase(gapService),
    listActivities: new ListActivitiesUseCase(gapService),
    createActivity: new CreateActivityUseCase(gapService),
    updateActivity: new UpdateActivityUseCase(gapService),
    removeActivity: new RemoveActivityUseCase(gapService),
    setGapStatus: new SetGapStatusUseCase(gapService),
    createCustomNotification: new CreateCustomNotificationUseCase(p.scheduled, p.schedules),
    listScheduled: new ListScheduledUseCase(p.scheduled),
    cancelScheduled: new CancelScheduledUseCase(p.scheduled),
    listCatalog: new ListCatalogUseCase(p.catalog),
    createFaculty: catalogAudit<{ actorId: string; name: string }, { id: string; name: string }>('CATALOG_CREATE_FACULTY', new CreateFacultyUseCase(p.catalog)),
    createProgram: catalogAudit<{ actorId: string; code: string; name: string; facultyId: string }, unknown>('CATALOG_CREATE_PROGRAM', new CreateProgramUseCase(p.catalog)),
    updateProgram: catalogAudit<{ actorId: string; id: string; name?: string; facultyId?: string }, unknown>('CATALOG_UPDATE_PROGRAM', new UpdateProgramUseCase(p.catalog)),
    deleteProgram: catalogAudit<{ actorId: string; id: string }, void>('CATALOG_DELETE_PROGRAM', new DeleteProgramUseCase(p.catalog)),
    auditReader: p.auditReader,
    logout: new LogoutUseCase(p.revoked, refresh),
    getWeekly,
    getDetail,
    exportSchedule: new ExportScheduleUseCase(weekly, p.users, p.exporters),
    sync,
    syncRuns: p.syncRuns,
    bus: p.bus,
    users: p.users,
    semester: cfg.semester,
    eventLog: p.eventLog,
    notifications: p.notifications,
    hub: p.hub,
    tokens: p.tokens,
    revoked: p.revoked,
  };
}
export type Container = ReturnType<typeof buildContainer>;
