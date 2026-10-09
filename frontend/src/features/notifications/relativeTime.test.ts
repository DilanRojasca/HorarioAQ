import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const now = new Date('2026-10-09T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('relativeTime', () => {
  it('usa "hace" para minutos, horas y días en es-CO', () => {
    expect(relativeTime(ago(5 * 60_000), now)).toBe('hace 5 minutos');
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe('hace 3 horas');
    expect(relativeTime(ago(3 * 86_400_000), now)).toBe('hace 3 días');
  });
  it('muestra "ahora" para menos de un minuto (o fechas futuras por desfase de reloj)', () => {
    expect(relativeTime(ago(10_000), now)).toBe('ahora');
    expect(relativeTime(ago(-30_000), now)).toBe('ahora');
  });
  it('pasada una semana muestra la fecha y tolera fechas inválidas', () => {
    const iso = ago(10 * 86_400_000);
    expect(relativeTime(iso, now)).toBe(new Date(iso).toLocaleDateString('es-CO'));
    expect(relativeTime('nope', now)).toBe('');
  });
});
