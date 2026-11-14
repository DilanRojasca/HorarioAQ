import { randomUUID } from 'crypto';
import { ClassSession, ScheduleChange } from '../../src/modules/schedule/domain/types';
import {
  EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRecord, SyncRunRepository,
} from '../../src/modules/schedule/application/ports';
import {
  NewUser, NotifyChannel, OtpCodec, OtpMailer, OtpPurpose, OtpRecord, OtpRepository, PasswordHasher, RefreshTokenRepository,
  RevokedTokenRepository, TokenPayload, TokenService, User, UserRepository,
} from '../../src/modules/auth/application/ports';
import { GapActivityRecord, GapKey, GapRepository, GapSlotRecord, GapStatus } from '../../src/modules/gaps/application/ports';
import { CatalogRepository, FacultyRecord, ProgramRecord } from '../../src/modules/catalog/application/CatalogUseCases';
import { ScheduledKind, ScheduledNotificationRecord, ScheduledNotificationRepository } from '../../src/modules/notifications/application/ports';
import { AuditReader, AuditRecord } from '../../src/shared/ports';
import { EmailPort, MAX_EMAIL_ATTEMPTS, NotificationRecord, NotificationRepository } from '../../src/modules/notifications/application/ports';
import { NotificationKind } from '../../src/shared/events/types';
import { AuditEntry, AuditPort } from '../../src/shared/ports';
import { unauthorized } from '../../src/shared/errors';

export const session = (over: Partial<ClassSession> = {}): ClassSession => ({
  externalId: 'u1-ALG-1', userId: 'u1', semester: '2026-2', courseCode: 'ALG', courseName: 'Algoritmos',
  teacher: 'Marta', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201',
  status: 'ACTIVE', ...over,
});

export class InMemoryScheduleRepo implements ScheduleRepository {
  rows: ClassSession[] = [];
  appliedChanges: ScheduleChange[] = [];
  async findByUser(userId: string, semester: string) {
    return this.rows.filter((r) => r.userId === userId && r.semester === semester);
  }
  async findOne(userId: string, externalId: string) {
    return this.rows.find((r) => r.userId === userId && r.externalId === externalId) ?? null;
  }
  async applyChanges(userId: string, _semester: string, changes: ScheduleChange[]) {
    for (const c of changes) {
      this.rows = this.rows.filter((r) => !(r.userId === userId && r.externalId === c.externalId));
      if (c.after) this.rows.push(c.after);
      this.appliedChanges.push(c);
    }
  }
}

export class InMemoryEnrollmentRepo implements EnrollmentRepository {
  constructor(public active: string[] = []) {}
  async listActiveStudentIds() { return this.active; }
  async hasActive(userId: string) { return this.active.includes(userId); }
}

export class FakeInstitutional implements InstitutionalPort {
  data = new Map<string, ClassSession[]>();
  calls = 0;
  async fetchSchedule(userId: string) { this.calls++; return this.data.get(userId) ?? []; }
}

export class InMemorySyncRuns implements SyncRunRepository {
  runs: SyncRunRecord[] = [];
  async tryStart(trigger: string, actorId?: string) {
    const cutoff = Date.now() - 3_600_000;
    if (this.runs.some((r) => r.status === 'RUNNING' && r.startedAt.getTime() > cutoff)) return null;
    const rec: SyncRunRecord = {
      id: `run${this.runs.length + 1}`, trigger, actorId: actorId ?? null,
      startedAt: new Date(), finishedAt: null, studentsSynced: 0, changesCount: 0, status: 'RUNNING', stats: null,
    };
    this.runs.push(rec);
    return { id: rec.id };
  }
  async finish(id: string, r: { status: 'OK' | 'FAILED' | 'PARTIAL'; studentsSynced: number; changesCount: number }) {
    Object.assign(this.runs.find((x) => x.id === id)!, r, { finishedAt: new Date() });
  }
  async saveStats(id: string, stats: { added: number; updated: number; cancelled: number }) {
    this.runs.find((x) => x.id === id)!.stats = stats;
  }
  async list(limit: number) { return this.runs.slice(-limit).reverse(); }
}

export class InMemoryUsers implements UserRepository {
  constructor(public users: User[] = []) {}
  async findByEmail(email: string) { return this.users.find((u) => u.email === email) ?? null; }
  async findById(id: string) { return this.users.find((u) => u.id === id) ?? null; }
  async listStudents() { return this.users.filter((u) => u.role === 'STUDENT' && u.active); }
  async listAll() { return [...this.users]; }
  async create(n: NewUser) {
    const u: User = { id: randomUUID(), role: 'STUDENT', active: false, verifiedAt: null, ...n };
    this.users.push(u);
    return u;
  }
  async activate(id: string, at: Date) { Object.assign(this.users.find((u) => u.id === id)!, { active: true, verifiedAt: at }); }
  async updateProfile(id: string, d: { name?: string; avatarUrl?: string | null }) {
    const u = this.users.find((x) => x.id === id)!;
    Object.assign(u, d);
    return u;
  }
  async updatePassword(id: string, passwordHash: string) { this.users.find((u) => u.id === id)!.passwordHash = passwordHash; }
  async setRole(id: string, role: 'STUDENT' | 'ADMIN') { const u = this.users.find((x) => x.id === id)!; u.role = role; return u; }
  async updatePreferences(id: string, d: { notifyChannel?: NotifyChannel; reminderMinutes?: number }) {
    const u = this.users.find((x) => x.id === id)!;
    if (d.notifyChannel) u.notifyChannel = d.notifyChannel;
    if (d.reminderMinutes) u.reminderMinutes = d.reminderMinutes;
    return u;
  }
}

export class InMemoryOtps implements OtpRepository {
  rows: (OtpRecord & { usedAt: Date | null })[] = [];
  async create(o: { userId: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }) {
    this.rows.filter((r) => r.userId === o.userId && r.purpose === o.purpose && !r.usedAt).forEach((r) => { r.usedAt = new Date(); });
    this.rows.push({ id: randomUUID(), attempts: 0, usedAt: null, ...o });
  }
  async findActive(userId: string, purpose: OtpPurpose, now: Date) {
    return [...this.rows].reverse().find((r) => r.userId === userId && r.purpose === purpose && !r.usedAt && r.expiresAt > now) ?? null;
  }
  async recordFailedAttempt(id: string) { this.rows.find((r) => r.id === id)!.attempts++; }
  async markUsed(id: string, at: Date) { const r = this.rows.find((x) => x.id === id)!; if (r.usedAt) return false; r.usedAt = at; return true; }
}

/** Código fijo "123456" para poder verificar sin leer el correo. */
export class FixedOtpCodec implements OtpCodec {
  generate() { return '123456'; }
  hash(code: string, salt: string) { return `h:${salt}:${code}`; }
}

export class RecordingOtpMailer implements OtpMailer {
  sent: { email: string; code: string; purpose: OtpPurpose }[] = [];
  async sendOtp(to: { email: string }, code: string, purpose: OtpPurpose) { this.sent.push({ email: to.email, code, purpose }); }
}

export class InMemoryRefreshTokens implements RefreshTokenRepository {
  rows: { userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }[] = [];
  async create(r: { userId: string; tokenHash: string; expiresAt: Date }) { this.rows.push({ ...r, revokedAt: null }); }
  async consume(tokenHash: string, now: Date) {
    const t = this.rows.find((r) => r.tokenHash === tokenHash);
    if (!t || t.revokedAt || t.expiresAt <= now) return null;
    t.revokedAt = now;
    return { userId: t.userId };
  }
  async revokeByHash(tokenHash: string) { const t = this.rows.find((r) => r.tokenHash === tokenHash); if (t) t.revokedAt = new Date(); }
  async revokeAllForUser(userId: string) { this.rows.filter((r) => r.userId === userId).forEach((r) => { r.revokedAt ??= new Date(); }); }
}

export class InMemoryGaps implements GapRepository {
  activities: (GapActivityRecord & { userId: string })[] = [];
  slots: (GapSlotRecord & { userId: string })[] = [];
  private same = (a: GapKey, b: GapKey) => a.weekday === b.weekday && a.startTime === b.startTime && a.endTime === b.endTime;
  async listActivities(userId: string) { return this.activities.filter((a) => a.userId === userId); }
  async listSlots(userId: string) { return this.slots.filter((a) => a.userId === userId); }
  async findActivity(userId: string, k: GapKey) { return this.activities.find((a) => a.userId === userId && this.same(a, k)) ?? null; }
  async createActivity(userId: string, k: GapKey, title: string) {
    if (await this.findActivity(userId, k)) return null;
    const a = { id: randomUUID(), userId, ...k, title };
    this.activities.push(a);
    return a;
  }
  async updateActivity(userId: string, k: GapKey, title: string) {
    const ex = await this.findActivity(userId, k);
    if (!ex) return null;
    ex.title = title;
    return ex;
  }
  async deleteActivity(userId: string, k: GapKey) {
    const n = this.activities.length;
    this.activities = this.activities.filter((a) => !(a.userId === userId && this.same(a, k)));
    return this.activities.length < n;
  }
  async upsertSlot(userId: string, k: GapKey, status: GapStatus) {
    const ex = this.slots.find((a) => a.userId === userId && this.same(a, k));
    if (ex) ex.status = status; else this.slots.push({ userId, ...k, status });
  }
}

export class InMemoryCatalog implements CatalogRepository {
  faculties: { id: string; name: string }[] = [];
  programs: ProgramRecord[] = [];
  async listFaculties(): Promise<FacultyRecord[]> { return this.faculties.map((f) => ({ ...f, programs: this.programs.filter((p) => p.facultyId === f.id) })); }
  async findFaculty(id: string) { return this.faculties.find((f) => f.id === id) ?? null; }
  async createFaculty(name: string) { const f = { id: randomUUID(), name }; this.faculties.push(f); return f; }
  async findProgramByCode(code: string) { return this.programs.find((p) => p.code === code) ?? null; }
  async findProgram(id: string) { return this.programs.find((p) => p.id === id) ?? null; }
  async createProgram(p: { code: string; name: string; facultyId: string }) { const r = { id: randomUUID(), ...p }; this.programs.push(r); return r; }
  async updateProgram(id: string, p: { name?: string; facultyId?: string }) {
    const r = this.programs.find((x) => x.id === id)!;
    if (p.name) r.name = p.name;
    if (p.facultyId) r.facultyId = p.facultyId;
    return r;
  }
  async deleteProgram(id: string) { this.programs = this.programs.filter((p) => p.id !== id); }
}

export class InMemoryScheduled implements ScheduledNotificationRepository {
  rows: (ScheduledNotificationRecord & { dedupKey?: string })[] = [];
  async create(n: { userId: string; kind: ScheduledKind; title: string; message: string; fireAt: Date; dedupKey?: string }) {
    if (n.dedupKey && this.rows.some((r) => r.dedupKey === n.dedupKey)) return false;
    this.rows.push({ id: randomUUID(), firedAt: null, ...n });
    return true;
  }
  async listPendingByUser(userId: string) { return this.rows.filter((r) => r.userId === userId && !r.firedAt); }
  async cancel(userId: string, id: string) {
    const n = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.id === id && r.userId === userId && !r.firedAt));
    return this.rows.length < n;
  }
  async claimDue(now: Date, limit: number) {
    const due = this.rows.filter((r) => !r.firedAt && r.fireAt <= now).slice(0, limit);
    due.forEach((r) => { r.firedAt = now; });
    return due;
  }
}

export class InMemoryAuditReader implements AuditReader {
  constructor(private audit: RecordingAudit) {}
  async listRecent(limit: number, f: { action?: string } = {}) {
    return this.audit.entries.filter((e) => !f.action || e.action === f.action).slice(-limit).reverse()
      .map((e, i) => ({ ...e, id: String(i), createdAt: new Date() }) as AuditRecord);
  }
}

/** Puertos nuevos (auth ampliada, huecos, catálogo, programadas) para las pruebas que arman el contenedor completo. */
export function extraPorts(audit: RecordingAudit) {
  return {
    otps: new InMemoryOtps(), refreshTokens: new InMemoryRefreshTokens(), otpCodec: new FixedOtpCodec(), otpMailer: new RecordingOtpMailer(),
    gaps: new InMemoryGaps(), catalog: new InMemoryCatalog(), scheduled: new InMemoryScheduled(), auditReader: new InMemoryAuditReader(audit),
  };
}

export class InMemoryRevoked implements RevokedTokenRepository {
  set = new Set<string>();
  async revoke(jti: string) { this.set.add(jti); }
  async isRevoked(jti: string) { return this.set.has(jti); }
}

export class FakeHasher implements PasswordHasher {
  async hash(p: string) { return `hash:${p}`; }
  async verify(h: string, p: string) { return h === `hash:${p}`; }
}

/** Tokens "tok:<id>:<ROLE>:<jti>" — sin criptografía, solo para pruebas. */
export class FakeTokens implements TokenService {
  private n = 0;
  sign(u: { id: string; role: 'STUDENT' | 'ADMIN' }) { return `tok:${u.id}:${u.role}:j${++this.n}`; }
  verify(token: string): TokenPayload {
    const [p, sub, role, jti] = token.split(':');
    if (p !== 'tok') throw unauthorized('Token inválido');
    return { sub, role: role as 'STUDENT' | 'ADMIN', jti, exp: Math.floor(Date.now() / 1000) + 3600 };
  }
}

export class RecordingAudit implements AuditPort {
  entries: AuditEntry[] = [];
  async record(e: AuditEntry) { this.entries.push(e); }
}

export class InMemoryNotifications implements NotificationRepository {
  rows: NotificationRecord[] = [];
  private n = 0;
  async create(n: { userId: string; kind: NotificationKind; title: string; message: string }) {
    const rec: NotificationRecord = {
      id: randomUUID(), ...n, createdAt: new Date(Date.now() + ++this.n), readAt: null, emailedAt: null, emailSkippedAt: null, emailAttempts: 0,
    };
    this.rows.push(rec);
    return rec;
  }
  async listByUser(userId: string, opts: { unreadOnly?: boolean; limit: number }) {
    return this.rows
      .filter((r) => r.userId === userId && (!opts.unreadOnly || r.readAt === null))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, opts.limit);
  }
  async countUnread(userId: string) { return this.rows.filter((r) => r.userId === userId && r.readAt === null).length; }
  async markRead(userId: string, id: string) {
    const r = this.rows.find((x) => x.id === id && x.userId === userId);
    if (!r) return false;
    r.readAt ??= new Date();
    return true;
  }
  async markAllRead(userId: string) {
    const unread = this.rows.filter((r) => r.userId === userId && r.readAt === null);
    unread.forEach((r) => { r.readAt = new Date(); });
    return unread.length;
  }
  async findById(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async claimEmail(id: string, at: Date) {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.emailedAt !== null || r.emailSkippedAt !== null) return false;
    r.emailedAt = at;
    return true;
  }
  async releaseEmail(id: string) {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.emailedAt = null;
  }
  async recordEmailFailure(id: string) {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.emailAttempts++;
  }
  async markEmailSkipped(id: string, at: Date) {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.emailSkippedAt = at;
  }
  async listPendingEmail(since: Date, limit: number) {
    return this.rows
      .filter((r) => r.emailedAt === null && r.emailSkippedAt === null && r.emailAttempts < MAX_EMAIL_ATTEMPTS && r.createdAt >= since)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }
}

export class RecordingEmail implements EmailPort {
  sent: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  attempts = 0;
  /** Si se define, todos los envíos fallan con este error. */
  failWith?: Error;
  /** Número de envíos que fallan antes de empezar a funcionar. */
  failTimes = 0;
  async send(msg: { to: string; subject: string; text: string; html?: string }) {
    this.attempts++;
    if (this.failWith) throw this.failWith;
    if (this.failTimes > 0) { this.failTimes--; throw new Error('fallo transitorio'); }
    this.sent.push(msg);
  }
}
