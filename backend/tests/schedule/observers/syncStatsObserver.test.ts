import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../../src/shared/events/InMemoryEventLog';
import { registerSyncStatsObserver } from '../../../src/modules/schedule/observers/syncStatsObserver';
import { InMemorySyncRuns } from '../../helpers/inMemory';

const payload = (runId: string) => ({
  runId, trigger: 'MANUAL' as const, studentsSynced: 3, changesCount: 6, failures: 0,
  changesByType: { ADDED: 3, UPDATED: 2, CANCELLED: 1 },
});

describe('syncStatsObserver', () => {
  let runs: InMemorySyncRuns, log: InMemoryEventLog, bus: EventBus;

  beforeEach(() => {
    runs = new InMemorySyncRuns();
    log = new InMemoryEventLog();
    bus = new EventBus({ log, sleep: async () => {} });
  });

  it('guarda las estadísticas de la corrida al recibir SyncCompleted', async () => {
    const run = (await runs.tryStart('MANUAL'))!;
    registerSyncStatsObserver(bus, runs);
    await bus.publish('SyncCompleted', payload(run.id));
    expect(runs.runs[0].stats).toEqual({ added: 3, updated: 2, cancelled: 1 });
  });

  it('si saveStats lanza, el bus reintenta y registra FAILED sin romper al publicador', async () => {
    let calls = 0;
    runs.saveStats = async () => { calls++; throw new Error('bd caída'); };
    registerSyncStatsObserver(bus, runs);
    const report = await bus.publish('SyncCompleted', payload('run1'));
    expect(calls).toBe(3); // 1 intento + 2 reintentos
    expect(report.deliveries).toEqual([{ observer: 'sync-stats', status: 'FAILED', attempts: 3, error: 'bd caída' }]);
    expect(log.deliveries[0].delivery.status).toBe('FAILED');
  });
});
