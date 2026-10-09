import { describe, it, expect } from 'vitest';
import { isWithinSendWindow } from '../../src/shared/window';

// Bogotá es UTC-5 todo el año: 05:59 local = 10:59Z.
const bogota = (hhmm: string) => new Date(`2026-10-09T${hhmm}:00-05:00`);

describe('isWithinSendWindow (America/Bogota, 6 <= hora < 22)', () => {
  it('05:59 queda fuera', () => expect(isWithinSendWindow(bogota('05:59'))).toBe(false));
  it('06:00 queda dentro', () => expect(isWithinSendWindow(bogota('06:00'))).toBe(true));
  it('21:59 queda dentro', () => expect(isWithinSendWindow(bogota('21:59'))).toBe(true));
  it('22:00 queda fuera', () => expect(isWithinSendWindow(bogota('22:00'))).toBe(false));
  it('un instante UTC que en Bogotá es 05:30 queda fuera', () => {
    expect(isWithinSendWindow(new Date('2026-10-09T10:30:00Z'))).toBe(false);
  });
  it('medianoche local queda fuera aunque la hora UTC sea de día', () => {
    expect(isWithinSendWindow(new Date('2026-10-09T05:00:00Z'))).toBe(false); // 00:00 Bogotá
  });
  it('es configurable: ventana y zona horaria', () => {
    const d = new Date('2026-10-09T10:30:00Z'); // 05:30 Bogotá, 12:30 Madrid
    expect(isWithinSendWindow(d, { start: 5, end: 6 })).toBe(true);
    expect(isWithinSendWindow(d, { timeZone: 'Europe/Madrid' })).toBe(true);
    expect(isWithinSendWindow(d, { start: 13, end: 22, timeZone: 'Europe/Madrid' })).toBe(false);
  });
});
