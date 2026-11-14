import { describe, it, expect, beforeEach } from 'vitest';
import { detectGaps } from '../../src/modules/gaps/domain/gaps';
import { suggestFor } from '../../src/modules/gaps/domain/suggestions';
import { CreateActivityUseCase, GapService, ListActivitiesUseCase, ListGapsUseCase, RemoveActivityUseCase, SetGapStatusUseCase, UpdateActivityUseCase } from '../../src/modules/gaps/application/GapUseCases';
import { InMemoryEnrollmentRepo, InMemoryGaps, InMemoryScheduleRepo, session } from '../helpers/inMemory';

const s = (startTime: string, endTime: string, weekday = 1, over = {}) =>
  session({ externalId: `${weekday}-${startTime}`, startTime, endTime, weekday: weekday as 1, ...over });

describe('detectGaps (RF-HUE-01)', () => {
  it('huecos entre clases consecutivas del mismo día; ignora el resto del día', () => {
    expect(detectGaps([s('08:00', '10:00'), s('11:00', '13:00'), s('15:00', '17:00')])).toEqual([
      { weekday: 1, startTime: '10:00', endTime: '11:00', minutes: 60 },
      { weekday: 1, startTime: '13:00', endTime: '15:00', minutes: 120 },
    ]);
  });
  it('no mezcla días, ignora canceladas y huecos menores a 15 min', () => {
    expect(detectGaps([s('08:00', '10:00', 1), s('11:00', '12:00', 2)])).toEqual([]);
    expect(detectGaps([s('08:00', '10:00'), s('10:10', '12:00')])).toEqual([]);
    expect(detectGaps([s('08:00', '10:00'), s('10:30', '11:00', 1, { status: 'CANCELLED' }), s('12:00', '13:00')]))
      .toEqual([{ weekday: 1, startTime: '10:00', endTime: '12:00', minutes: 120 }]);
  });
  it('clases superpuestas no generan huecos falsos', () => {
    expect(detectGaps([s('08:00', '12:00'), s('09:00', '10:00'), s('13:00', '14:00')]))
      .toEqual([{ weekday: 1, startTime: '12:00', endTime: '13:00', minutes: 60 }]);
  });
  it('los huecos salen ordenados por día y hora', () => {
    const g = detectGaps([s('08:00', '09:00', 3), s('11:00', '12:00', 3), s('08:00', '09:00', 1), s('11:00', '12:00', 1)]);
    expect(g.map((x) => x.weekday)).toEqual([1, 3]);
  });
});

describe('Estrategias de sugerencia (RF-HUE-02)', () => {
  it.each([[15, 'REST'], [29, 'REST'], [30, 'MEAL'], [60, 'MEAL'], [61, 'STUDY'], [240, 'STUDY']])('%i min → %s', (m, kind) => {
    expect(suggestFor(m)!.kind).toBe(kind);
  });
  it('acepta estrategias propias (Open/Closed)', () => {
    const custom = { kind: 'STUDY' as const, appliesTo: () => true, suggest: () => ({ kind: 'STUDY' as const, title: 'X', detail: 'Y' }) };
    expect(suggestFor(5, [custom])!.title).toBe('X');
    expect(suggestFor(5, [])).toBeNull();
  });
});

describe('Casos de uso de huecos (RF-HUE-03/04)', () => {
  let repo: InMemoryScheduleRepo, gaps: InMemoryGaps, svc: GapService;
  const key = { weekday: 1 as const, startTime: '10:00', endTime: '11:00' };
  beforeEach(() => {
    repo = new InMemoryScheduleRepo(); gaps = new InMemoryGaps();
    repo.rows = [s('08:00', '10:00', 1, { userId: 'u1' }), s('11:00', '13:00', 1, { userId: 'u1' })];
    svc = new GapService(repo, new InMemoryEnrollmentRepo(['u1']), gaps, '2026-2');
  });
  it('lista con sugerencia; sin matrícula no hay huecos', async () => {
    const [g] = await new ListGapsUseCase(svc).execute({ userId: 'u1' });
    expect(g).toMatchObject({ ...key, minutes: 60, status: 'AVAILABLE', activity: null, suggestion: { kind: 'MEAL' } });
    expect(await new ListGapsUseCase(svc).execute({ userId: 'otro' })).toEqual([]);
  });
  it('CRUD de actividades: crear, listar, actualizar y eliminar; la actividad reemplaza la sugerencia', async () => {
    const created = await new CreateActivityUseCase(svc).execute({ userId: 'u1', gap: key, title: ' Biblioteca ' });
    expect(created).toMatchObject({ ...key, title: 'Biblioteca' });
    expect(await new ListActivitiesUseCase(svc).execute({ userId: 'u1' })).toHaveLength(1);
    expect((await svc.list('u1'))[0]).toMatchObject({ activity: { title: 'Biblioteca' }, suggestion: null });
    expect(await new UpdateActivityUseCase(svc).execute({ userId: 'u1', gap: key, title: 'Gimnasio' })).toMatchObject({ title: 'Gimnasio' });
    await new RemoveActivityUseCase(svc).execute({ userId: 'u1', gap: key });
    expect((await svc.list('u1'))[0].suggestion).not.toBeNull();
    await expect(new RemoveActivityUseCase(svc).execute({ userId: 'u1', gap: key })).rejects.toMatchObject({ status: 404 });
    await expect(new UpdateActivityUseCase(svc).execute({ userId: 'u1', gap: key, title: 'x' })).rejects.toMatchObject({ status: 404 });
  });
  it('regla de negocio: un hueco con actividad no admite otra (409) y uno ocupado tampoco (409)', async () => {
    const create = new CreateActivityUseCase(svc);
    await create.execute({ userId: 'u1', gap: key, title: 'Uno' });
    await expect(create.execute({ userId: 'u1', gap: key, title: 'Dos' })).rejects.toMatchObject({ status: 409, message: /ya tiene una actividad/ });
    await new RemoveActivityUseCase(svc).execute({ userId: 'u1', gap: key });
    await new SetGapStatusUseCase(svc).execute({ userId: 'u1', gap: key, status: 'OCCUPIED' });
    await expect(create.execute({ userId: 'u1', gap: key, title: 'Tres' })).rejects.toMatchObject({ status: 409, message: /ocupado/ });
  });
  it('marcar OCUPADO quita las sugerencias; volver a DISPONIBLE las devuelve', async () => {
    await new SetGapStatusUseCase(svc).execute({ userId: 'u1', gap: key, status: 'OCCUPIED' });
    expect((await svc.list('u1'))[0]).toMatchObject({ status: 'OCCUPIED', suggestion: null });
    await new SetGapStatusUseCase(svc).execute({ userId: 'u1', gap: key, status: 'AVAILABLE' });
    expect((await svc.list('u1'))[0].suggestion).not.toBeNull();
  });
  it('rechaza huecos inexistentes y títulos inválidos', async () => {
    const fake = { weekday: 2 as const, startTime: '10:00', endTime: '11:00' };
    await expect(new CreateActivityUseCase(svc).execute({ userId: 'u1', gap: fake, title: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(new SetGapStatusUseCase(svc).execute({ userId: 'u1', gap: fake, status: 'OCCUPIED' })).rejects.toMatchObject({ status: 404 });
    await expect(new CreateActivityUseCase(svc).execute({ userId: 'u1', gap: key, title: '  ' })).rejects.toMatchObject({ status: 400 });
  });
});
