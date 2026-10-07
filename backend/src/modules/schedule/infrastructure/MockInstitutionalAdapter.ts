import { ClassSession, Weekday } from '../domain/types';
import { InstitutionalPort } from '../application/ports';

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
 * Simula el sistema académico institucional (RRF-07). Por usuario: la 1.ª consulta
 * devuelve el horario base; las siguientes devuelven una variante con cambios
 * (ALG101 → bloque B aula 305, PHY201 cancelada, nueva LAB301).
 */
export class MockInstitutionalAdapter implements InstitutionalPort {
  private fetches = new Map<string, number>();

  async fetchSchedule(userId: string, semester: string): Promise<ClassSession[]> {
    const round = this.fetches.get(userId) ?? 0;
    this.fetches.set(userId, round + 1);

    const build = (t: Tpl, over: Partial<ClassSession> = {}): ClassSession => ({
      ...t, userId, semester, externalId: `${userId}-${t.courseCode}-${t.weekday}`, status: 'ACTIVE', ...over,
    });

    const rows = BASE.map((t) => {
      if (round === 0) return build(t);
      if (t.courseCode === 'ALG101') return build(t, { block: 'B', floor: 3, room: '305' });
      if (t.courseCode === 'PHY201') return build(t, { status: 'CANCELLED' });
      return build(t);
    });
    if (round > 0) rows.push(build(LAB));
    return rows;
  }
}
