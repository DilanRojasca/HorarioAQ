import { ClassSession, ScheduleChange } from '../domain/types';

/** @pattern Repository | Puerto de horarios | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. */
export interface ScheduleRepository {
  findByUser(userId: string, semester: string): Promise<ClassSession[]>;
  findOne(userId: string, externalId: string): Promise<ClassSession | null>;
  applyChanges(userId: string, semester: string, changes: ScheduleChange[]): Promise<void>;
}

/** @pattern Repository | Puerto de matrículas | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. */
export interface EnrollmentRepository {
  listActiveStudentIds(semester: string): Promise<string[]>;
  hasActive(userId: string, semester: string): Promise<boolean>;
}

/** @pattern Hexagonal (puerto) | Puerto: sistema institucional | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. */
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
  stats: SyncStats | null;
}

export type SyncStats = { added: number; updated: number; cancelled: number };

/** @pattern Repository | Puerto de corridas de sincronización | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. */
export interface SyncRunRepository {
  /** Inicia una corrida; devuelve null si ya hay otra RUNNING iniciada hace menos de 1 h (single-flight). */
  tryStart(trigger: string, actorId?: string): Promise<{ id: string } | null>;
  finish(id: string, r: { status: 'OK' | 'FAILED' | 'PARTIAL'; studentsSynced: number; changesCount: number }): Promise<void>;
  /** Guarda el desglose de cambios de la corrida (lo escribe el observador de estadísticas). */
  saveStats(id: string, stats: SyncStats): Promise<void>;
  list(limit: number): Promise<SyncRunRecord[]>;
}
