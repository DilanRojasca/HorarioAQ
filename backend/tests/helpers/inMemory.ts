import { randomUUID } from 'crypto';
import { ClassSession, ScheduleChange } from '../../src/modules/schedule/domain/types';
import {
  EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRecord, SyncRunRepository,
} from '../../src/modules/schedule/application/ports';
import {
  PasswordHasher, RevokedTokenRepository, TokenPayload, TokenService, User, UserRepository,
} from '../../src/modules/auth/application/ports';
import { NotificationRecord, NotificationRepository } from '../../src/modules/notifications/application/ports';
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
      id: randomUUID(), ...n, createdAt: new Date(Date.now() + ++this.n), readAt: null, emailedAt: null,
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
  async markEmailed(id: string, at: Date) {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.emailedAt = at;
  }
  async listPendingEmail(since: Date, limit: number) {
    return this.rows
      .filter((r) => r.emailedAt === null && r.createdAt >= since)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }
}
