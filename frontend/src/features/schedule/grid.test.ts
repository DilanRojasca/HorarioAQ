import { describe, it, expect } from 'vitest';
import { gridRow, sessionsByDay, todaySessions, toMinutes } from './grid';
import type { Session } from './types';

const s = (weekday: number, startTime: string, id = `${weekday}${startTime}`): Session => ({
  externalId: id, userId: 'u', semester: '2026-2', courseCode: 'X', courseName: 'X', teacher: 'T',
  weekday: weekday as Session['weekday'], startTime, endTime: '23:00', block: 'A', floor: 1, room: '1', status: 'ACTIVE',
});

describe('grid', () => {
  it('toMinutes', () => { expect(toMinutes('08:30')).toBe(510); });
  it('gridRow: 07:00 → fila 2; 08:00 → fila 4; 08:30 → fila 5', () => {
    expect(gridRow('07:00')).toBe(2);
    expect(gridRow('08:00')).toBe(4);
    expect(gridRow('08:30')).toBe(5);
  });
  it('sessionsByDay agrupa y ordena por hora', () => {
    const r = sessionsByDay([s(2, '10:00'), s(1, '14:00'), s(1, '08:00')]);
    expect(r[1].map((x) => x.startTime)).toEqual(['08:00', '14:00']);
    expect(r[2]).toHaveLength(1);
    expect(r[3]).toEqual([]);
  });
  it('todaySessions usa el día ISO de la fecha dada', () => {
    const wed = new Date('2026-10-07T12:00:00'); // miércoles
    expect(todaySessions([s(3, '08:00'), s(1, '08:00')], wed)).toHaveLength(1);
    const sun = new Date('2026-10-04T12:00:00'); // domingo → 7
    expect(todaySessions([s(7, '08:00')], sun)).toHaveLength(1);
  });
});
