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
  /** Inicia una corrida; devuelve null si ya hay otra RUNNING iniciada hace menos de 1 h (single-flight). */
  tryStart(trigger: string, actorId?: string): Promise<{ id: string } | null>;
  finish(id: string, r: { status: 'OK' | 'FAILED' | 'PARTIAL'; studentsSynced: number; changesCount: number }): Promise<void>;
  list(limit: number): Promise<SyncRunRecord[]>;
}
