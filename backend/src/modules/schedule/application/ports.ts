import { ClassSession, ScheduleChange } from '../domain/types';

export interface ScheduleRepository {
  findByUser(userId: string, semester: string): Promise<ClassSession[]>;
  findOne(userId: string, externalId: string): Promise<ClassSession | null>;
  applyChanges(userId: string, semester: string, changes: ScheduleChange[]): Promise<void>;
}

export interface EnrollmentRepository {
  listActiveStudentIds(semester: string): Promise<string[]>;
  hasActive(userId: string, semester: string): Promise<boolean>;
}

export interface InstitutionalPort {
  fetchSchedule(userId: string, semester: string): Promise<ClassSession[]>;
}

export interface SyncRunRecord {
  id: string;
  trigger: string;
  actorId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  studentsSynced: number;
  changesCount: number;
  status: string;
}

export interface SyncRunRepository {
  start(trigger: string, actorId?: string): Promise<{ id: string }>;
  finish(id: string, r: { status: 'OK' | 'FAILED'; studentsSynced: number; changesCount: number }): Promise<void>;
  list(limit: number): Promise<SyncRunRecord[]>;
}
