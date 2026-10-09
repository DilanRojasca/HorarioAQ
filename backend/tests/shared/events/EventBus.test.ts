import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../../src/shared/events/InMemoryEventLog';
import type { DomainEvent, EventMap } from '../../../src/shared/events/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failed: EventMap['SyncFailed'] = { runId: 'r1', trigger: 'MANUAL', message: 'boom' };
const created: EventMap['NotificationCreated'] = {
  notificationId: 'n1', userId: 'u1', title: 't', message: 'm', kind: 'SCHEDULE_ADDED',
};

describe('EventBus', () => {
  let sleep: ReturnType<typeof vi.fn>;
  let log: InMemoryEventLog;
  let bus: EventBus;

  beforeEach(() => {
    sleep = vi.fn(async () => {});
    log = new InMemoryEventLog();
    bus = new EventBus({ log, sleep });
  });

  it('entrega el evento a los observadores del tipo y no a otros tipos', async () => {
    const a = vi.fn(); const b = vi.fn();
    bus.subscribe('SyncFailed', a, { name: 'a' });
    bus.subscribe('NotificationCreated', b, { name: 'b' });
    await bus.publish('SyncFailed', failed);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('el DomainEvent entregado trae id (UUID), type, occurredAt y payload', async () => {
    const now = new Date('2026-10-09T10:00:00Z');
    bus = new EventBus({ log, sleep, now: () => now });
    let got: DomainEvent<'SyncFailed'> | undefined;
    bus.subscribe('SyncFailed', (e) => { got = e; }, { name: 'a' });
    await bus.publish('SyncFailed', failed);
    expect(got!.id).toMatch(UUID);
    expect(got).toMatchObject({ type: 'SyncFailed', occurredAt: now, payload: failed });
  });

  it('ordena por prioridad desc y, a igual prioridad, por orden de suscripción', async () => {
    const order: string[] = [];
    bus.subscribe('SyncFailed', () => { order.push('low'); }, { name: 'low', priority: 1 });
    bus.subscribe('SyncFailed', () => { order.push('first'); }, { name: 'first', priority: 5 });
    bus.subscribe('SyncFailed', () => { order.push('second'); }, { name: 'second', priority: 5 });
    await bus.publish('SyncFailed', failed);
    expect(order).toEqual(['first', 'second', 'low']);
  });

  it('unsubscribe() evita entregas posteriores y subscriberCount refleja altas/bajas', async () => {
    const a = vi.fn();
    const sub = bus.subscribe('SyncFailed', a, { name: 'a' });
    expect(bus.subscriberCount('SyncFailed')).toBe(1);
    sub.unsubscribe();
    expect(bus.subscriberCount('SyncFailed')).toBe(0);
    await bus.publish('SyncFailed', failed);
    expect(a).not.toHaveBeenCalled();
  });

  it('once entrega una sola vez, también con dos publicaciones seguidas', async () => {
    const a = vi.fn();
    bus.subscribe('SyncFailed', a, { name: 'a', once: true });
    await Promise.all([bus.publish('SyncFailed', failed), bus.publish('SyncFailed', failed)]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(bus.subscriberCount('SyncFailed')).toBe(0);
  });

  it('aislamiento: un observador que lanza no impide que los siguientes reciban el evento', async () => {
    const next = vi.fn();
    bus.subscribe('SyncFailed', () => { throw new Error('x'); }, { name: 'bad', priority: 10, retries: 0 });
    bus.subscribe('SyncFailed', next, { name: 'ok' });
    await expect(bus.publish('SyncFailed', failed)).resolves.toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reintenta con backoff exponencial: falla 2 veces y luego OK con attempts 3', async () => {
    let n = 0;
    bus.subscribe('SyncFailed', () => { if (++n <= 2) throw new Error('fallo'); }, { name: 'flaky', retries: 2 });
    const report = await bus.publish('SyncFailed', failed);
    expect(report.deliveries).toEqual([{ observer: 'flaky', status: 'OK', attempts: 3 }]);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('respeta backoffMs configurable', async () => {
    let n = 0;
    bus.subscribe('SyncFailed', () => { if (++n <= 1) throw new Error('f'); }, { name: 'f', retries: 1, backoffMs: 50 });
    await bus.publish('SyncFailed', failed);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it('agotados los reintentos queda FAILED con attempts retries+1 y el mensaje del error', async () => {
    bus.subscribe('SyncFailed', () => { throw new Error('siempre'); }, { name: 'bad', retries: 2 });
    const report = await bus.publish('SyncFailed', failed);
    expect(report.deliveries).toEqual([{ observer: 'bad', status: 'FAILED', attempts: 3, error: 'siempre' }]);
  });

  it('el reporte lista cada observador con estado e intentos en orden de ejecución', async () => {
    bus.subscribe('SyncFailed', () => {}, { name: 'b' });
    bus.subscribe('SyncFailed', () => { throw new Error('e'); }, { name: 'a', priority: 9, retries: 0 });
    const report = await bus.publish('SyncFailed', failed);
    expect(report.eventId).toMatch(UUID);
    expect(report.deliveries.map((d) => [d.observer, d.status, d.attempts])).toEqual([
      ['a', 'FAILED', 1], ['b', 'OK', 1],
    ]);
  });

  it('registra evento y entregas en el historial; si el historial lanza, publish igual resuelve', async () => {
    bus.subscribe('SyncFailed', () => {}, { name: 'a' });
    const report = await bus.publish('SyncFailed', failed);
    expect(log.events.map((e) => e.id)).toEqual([report.eventId]);
    expect(log.deliveries).toEqual([{ eventId: report.eventId, delivery: { observer: 'a', status: 'OK', attempts: 1 } }]);

    const broken = new InMemoryEventLog();
    broken.recordEvent = async () => { throw new Error('db'); };
    broken.recordDelivery = async () => { throw new Error('db'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran = vi.fn();
    const bus2 = new EventBus({ log: broken, sleep });
    bus2.subscribe('SyncFailed', ran, { name: 'a' });
    await expect(bus2.publish('SyncFailed', failed)).resolves.toBeDefined();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('un observador puede publicar otro evento (re-entrada) e idle() espera a ambos', async () => {
    const inner = vi.fn(async () => { await Promise.resolve(); });
    bus.subscribe('NotificationCreated', inner, { name: 'inner' });
    bus.subscribe('SyncFailed', () => { void bus.publish('NotificationCreated', created); }, { name: 'outer' });
    void bus.publish('SyncFailed', failed);
    await bus.idle();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('idle() resuelve de inmediato cuando no hay publicaciones en vuelo', async () => {
    await expect(bus.idle()).resolves.toBeUndefined();
  });
});
