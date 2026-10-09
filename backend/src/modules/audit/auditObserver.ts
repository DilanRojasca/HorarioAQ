import { EventBus } from '../../shared/events/EventBus';
import { Subscription } from '../../shared/events/types';
import { AuditPort } from '../../shared/ports';

/** Observador de auditoría: registra cada ScheduleChanged con la máxima prioridad. */
export function registerAuditObserver(bus: EventBus, audit: AuditPort): Subscription[] {
  return [
    bus.subscribe('ScheduleChanged', async (e) => {
      const { userId, semester } = e.payload;
      const changes = e.payload.changes.map((c) => ({ type: c.type, externalId: c.externalId }));
      await audit.record({
        actorId: 'system', action: 'SCHEDULE_CHANGED', entity: 'schedule',
        detail: { userId, semester, changes },
      });
    }, { name: 'audit', priority: 100 }),
  ];
}
