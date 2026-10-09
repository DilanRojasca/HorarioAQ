import { describe, it, expect } from 'vitest';
import { eventTypeLabel, formatDateTime, statsLabel, statusBadge, triggerLabel } from './runs';

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

describe('statsLabel', () => {
  it('formatea +agregadas ~modificadas −canceladas', () => {
    expect(statsLabel({ added: 2, updated: 5, cancelled: 1 })).toBe('+2 ~5 −1');
    expect(statsLabel({ added: 0, updated: 0, cancelled: 0 })).toBe('+0 ~0 −0');
  });
  it('devuelve null si no hay estadísticas', () => {
    expect(statsLabel(null)).toBeNull();
    expect(statsLabel(undefined)).toBeNull();
  });
});

describe('eventTypeLabel', () => {
  it('traduce los tipos de evento conocidos y deja el resto igual', () => {
    expect(eventTypeLabel('ScheduleChanged')).toBe('Horario cambiado');
    expect(eventTypeLabel('SyncCompleted')).toBe('Sincronización completada');
    expect(eventTypeLabel('SyncFailed')).toBe('Sincronización fallida');
    expect(eventTypeLabel('NotificationCreated')).toBe('Notificación creada');
    expect(eventTypeLabel('Otro')).toBe('Otro');
  });
});
