import { describe, it, expect } from 'vitest';
import { describeChange } from '../../src/modules/notifications/domain/messages';
import { session } from '../helpers/inMemory';
import { ScheduleChange } from '../../src/modules/schedule/domain/types';

const base = session();
const updated = (over: Parameters<typeof session>[0]): ScheduleChange => ({
  type: 'UPDATED', externalId: base.externalId, userId: base.userId, before: base, after: session(over),
});

describe('describeChange', () => {
  it('ADDED', () => {
    const r = describeChange({ type: 'ADDED', externalId: 'x', userId: 'u1', after: base });
    expect(r).toEqual({
      kind: 'SCHEDULE_ADDED',
      title: 'Nueva clase: Algoritmos',
      message: 'Algoritmos los Lunes de 08:00 a 10:00 en Bloque A, Aula 201.',
    });
  });

  it('CANCELLED usa el estado previo si existe', () => {
    const r = describeChange({ type: 'CANCELLED', externalId: 'x', userId: 'u1', before: base, after: { ...base, status: 'CANCELLED' } });
    expect(r).toEqual({
      kind: 'SCHEDULE_CANCELLED',
      title: 'Clase cancelada: Algoritmos',
      message: 'La clase de Algoritmos del Lunes (08:00–10:00) fue cancelada.',
    });
  });

  it('UPDATED con un solo campo cambiado', () => {
    const r = describeChange(updated({ room: '305' }));
    expect(r.kind).toBe('SCHEDULE_UPDATED');
    expect(r.title).toBe('Cambio en Algoritmos');
    expect(r.message).toBe('Aula: 201 → 305');
  });

  it('UPDATED con varios campos, en el orden indicado', () => {
    const r = describeChange(updated({
      room: '305', block: 'B', floor: 3, startTime: '09:00', endTime: '11:00', weekday: 2, teacher: 'Luis',
    }));
    expect(r.message).toBe(
      'Aula: 201 → 305 · Bloque: A → B · Piso: 2 → 3 · Horario: 08:00–10:00 → 09:00–11:00 · Día: Lunes → Martes · Docente: Marta → Luis',
    );
  });

  it('UPDATED sin cambios relevantes da un mensaje genérico', () => {
    const r = describeChange(updated({ courseCode: 'ALG2' }));
    expect(r.message).toBe('Se actualizó la clase.');
  });

  it('nombra todos los días en español', () => {
    const names = ([1, 2, 3, 4, 5, 6, 7] as const).map((d) =>
      describeChange({ type: 'ADDED', externalId: 'x', userId: 'u', after: session({ weekday: d }) }).message.split(' ')[2]);
    expect(names).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  });
});
