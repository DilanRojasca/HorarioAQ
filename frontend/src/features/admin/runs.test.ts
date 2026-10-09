import { describe, it, expect } from 'vitest';
import { formatDateTime, statusBadge, triggerLabel } from './runs';

describe('statusBadge', () => {
  it.each([
    ['OK', 'OK'],
    ['PARTIAL', 'Parcial'],
    ['FAILED', 'Fallido'],
    ['RUNNING', 'En curso'],
  ])('mapea %s a %s', (status, label) => {
    const b = statusBadge(status);
    expect(b.label).toBe(label);
    expect(b.classes).toMatch(/text-/);
  });

  it('usa los pares de color de Stitch para cada estado', () => {
    expect(statusBadge('OK').classes).toContain('text-[#1E7E34]');
    expect(statusBadge('PARTIAL').classes).toContain('text-[#9A5B00]');
    expect(statusBadge('FAILED').classes).toContain('text-[#B3261E]');
    expect(statusBadge('RUNNING').classes).toContain('text-primary');
  });

  it('muestra el valor crudo con estilo neutro si el estado es desconocido', () => {
    const b = statusBadge('WEIRD');
    expect(b.label).toBe('WEIRD');
    expect(b.classes).toContain('text-on-surface-variant');
  });
});

describe('triggerLabel', () => {
  it('traduce el origen', () => {
    expect(triggerLabel('MANUAL')).toBe('Manual');
    expect(triggerLabel('CRON')).toBe('Automática');
  });
  it('devuelve el valor crudo si es desconocido', () => {
    expect(triggerLabel('X')).toBe('X');
  });
});

describe('formatDateTime', () => {
  it('formatea en es-CO', () => {
    const iso = '2026-08-20T15:30:00.000Z';
    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString('es-CO'));
  });
  it('tolera fechas inválidas', () => {
    expect(formatDateTime('nope')).toBe('—');
  });
});
