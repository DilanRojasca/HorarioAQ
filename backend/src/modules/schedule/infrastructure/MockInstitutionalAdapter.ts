import { ClassSession, Weekday } from '../domain/types';
import { InstitutionalPort, SyncRunRepository } from '../application/ports';

type Tpl = Omit<ClassSession, 'userId' | 'semester' | 'externalId' | 'status'>;

const BASE: Tpl[] = [
  { courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta Gómez', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201' },
  { courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta Gómez', weekday: 3, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201' },
  { courseCode: 'CAL102', courseName: 'Cálculo', teacher: 'Luis Ortiz', weekday: 2, startTime: '10:00', endTime: '12:00', block: 'B', floor: 1, room: '105' },
  { courseCode: 'CAL102', courseName: 'Cálculo', teacher: 'Luis Ortiz', weekday: 4, startTime: '10:00', endTime: '12:00', block: 'B', floor: 1, room: '105' },
  { courseCode: 'PHY201', courseName: 'Física', teacher: 'Ana Ruiz', weekday: 1, startTime: '14:00', endTime: '16:00', block: 'C', floor: 3, room: '310' },
  { courseCode: 'DBS202', courseName: 'Bases de Datos', teacher: 'Carlos Peña', weekday: 3, startTime: '14:00', endTime: '16:00', block: 'A', floor: 2, room: '204' },
  { courseCode: 'ENG103', courseName: 'Inglés', teacher: 'Julia Stone', weekday: 5, startTime: '07:00', endTime: '09:00', block: 'D', floor: 1, room: '102' },
  { courseCode: 'SOF301', courseName: 'Ingeniería de Software', teacher: 'Diego Mora', weekday: 5, startTime: '10:00', endTime: '12:00', block: 'B', floor: 2, room: '208' },
];

const LAB: Tpl = { courseCode: 'LAB301', courseName: 'Laboratorio de Software', teacher: 'Diego Mora', weekday: 4 as Weekday, startTime: '14:00', endTime: '16:00', block: 'C', floor: 1, room: '110' };

/**
 * Simula el sistema académico institucional (RRF-07). Determinista y sin estado propio:
 * devuelve el horario base mientras no exista ninguna corrida de sincronización OK; desde
 * entonces devuelve una variante con cambios (ALG101 → bloque B piso 3 aula 305, PHY201
 * cancelada, nueva LAB301). Al depender del historial en BD es seguro ante reinicios y réplicas.
 */
export class MockInstitutionalAdapter implements InstitutionalPort {
  constructor(private syncRuns: SyncRunRepository) {}

  async fetchSchedule(userId: string, semester: string): Promise<ClassSession[]> {
    // La corrida en curso está RUNNING, así que no cuenta.
    const variant = (await this.syncRuns.list(200)).some((r) => r.status === 'OK');

    const build = (t: Tpl, over: Partial<ClassSession> = {}): ClassSession => ({
      ...t, userId, semester, externalId: `${userId}-${t.courseCode}-${t.weekday}`, status: 'ACTIVE', ...over,
    });

    const rows = BASE.map((t) => {
      if (!variant) return build(t);
      if (t.courseCode === 'ALG101') return build(t, { block: 'B', floor: 3, room: '305' });
      if (t.courseCode === 'PHY201') return build(t, { status: 'CANCELLED' });
      return build(t);
    });
    if (variant) rows.push(build(LAB));
    return rows;
  }
}
