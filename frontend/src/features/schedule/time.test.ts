import { describe, it, expect } from 'vitest';
import { classStatus, durationLabel, initials, shortDate, weekDays, dayLabel } from './time';
import type { Session } from './types';

const s = (id: string, weekday: number, startTime: string, endTime: string): Session => ({
  externalId: id, userId: 'u', semester: '2026-2', courseCode: 'X', courseName: id, teacher: 'T',
  weekday: weekday as Session['weekday'], startTime, endTime, block: 'A', floor: 1, room: '1', status: 'ACTIVE',
});

describe('durationLabel', () => {
  it('formatea horas, media hora y minutos', () => {
    expect(durationLabel('07:00', '09:00')).toBe('2 horas');
    expect(durationLabel('07:00', '08:00')).toBe('1 hora');
    expect(durationLabel('07:00', '08:30')).toBe('1 h 30 min');
    expect(durationLabel('07:00', '09:30')).toBe('2 h 30 min');
    expect(durationLabel('07:00', '07:45')).toBe('45 min');
  });
});

describe('classStatus', () => {
  const wed = (h: number, m = 0) => new Date(2026, 9, 7, h, m); // miércoles 7 oct 2026
  const list = [s('a', 3, '07:00', '09:00'), s('b', 3, '10:00', '12:00'), s('c', 3, '14:00', '16:00'), s('d', 4, '08:00', '10:00')];

  it('marca ONGOING la clase en curso y NEXT solo la primera futura', () => {
    expect(classStatus(list, wed(8))).toEqual({ a: 'ONGOING', b: 'NEXT' });
  });
  it('el inicio es inclusivo y el fin exclusivo', () => {
    expect(classStatus(list, wed(7))).toEqual({ a: 'ONGOING', b: 'NEXT' });
    expect(classStatus(list, wed(9))).toEqual({ b: 'NEXT' });
  });
  it('antes de la primera clase solo hay NEXT', () => {
    expect(classStatus(list, wed(6))).toEqual({ a: 'NEXT' });
  });
  it('después de la última no hay estados', () => {
    expect(classStatus(list, wed(17))).toEqual({});
  });
  it('ignora clases de otros días y no depende del orden de entrada', () => {
    expect(classStatus([...list].reverse(), wed(8))).toEqual({ a: 'ONGOING', b: 'NEXT' });
  });
});

describe('shortDate', () => {
  it('formatea día, mes abreviado y año', () => {
    expect(shortDate(new Date(2026, 7, 20))).toBe('20 Ago 2026');
    expect(shortDate(new Date(2026, 0, 5))).toBe('5 Ene 2026');
  });
});

describe('dayLabel', () => {
  it('nombre del día en minúsculas', () => {
    expect(dayLabel(new Date(2026, 9, 7))).toBe('miércoles');
    expect(dayLabel(new Date(2026, 9, 4))).toBe('domingo');
  });
});

describe('initials', () => {
  it('toma hasta dos letras en mayúscula', () => {
    expect(initials('Marta Lucía Gómez')).toBe('ML');
    expect(initials('  juan  ')).toBe('J');
    expect(initials('')).toBe('');
  });
});

describe('weekDays', () => {
  it('devuelve lunes a sábado de la semana actual', () => {
    const r = weekDays(new Date(2026, 9, 7)); // miércoles
    expect(r.map((d) => d.label)).toEqual(['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']);
    expect(r.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.map((d) => d.dayOfMonth)).toEqual([5, 6, 7, 8, 9, 10]);
  });
  it('en domingo usa la semana que termina ese día', () => {
    const r = weekDays(new Date(2026, 9, 4)); // domingo
    expect(r.map((d) => d.dayOfMonth)).toEqual([28, 29, 30, 1, 2, 3]);
  });
  it('cruza el cambio de mes', () => {
    const r = weekDays(new Date(2026, 10, 2)); // lunes 2 nov
    expect(r.map((d) => d.dayOfMonth)).toEqual([2, 3, 4, 5, 6, 7]);
  });
});
