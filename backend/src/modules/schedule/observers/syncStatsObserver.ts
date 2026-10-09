import { EventBus } from '../../../shared/events/EventBus';
import { Subscription } from '../../../shared/events/types';
import { SyncRunRepository } from '../application/ports';

/** Observador de estadísticas: guarda en la corrida el desglose de cambios de cada SyncCompleted. */
export function registerSyncStatsObserver(bus: EventBus, syncRuns: SyncRunRepository): Subscription[] {
  return [
    bus.subscribe('SyncCompleted', async (e) => {
      const { runId, changesByType } = e.payload;
      await syncRuns.saveStats(runId, {
        added: changesByType.ADDED, updated: changesByType.UPDATED, cancelled: changesByType.CANCELLED,
      });
    }, { name: 'sync-stats', priority: 40 }),
  ];
}
