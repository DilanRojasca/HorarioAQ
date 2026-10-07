import { AuditPort, EventBus } from '../../shared/ports';

export function registerAuditListener(bus: EventBus, audit: AuditPort) {
  bus.subscribe('ScheduleChanged', async (e) => {
    const changes = (e.changes as Array<{ type: string; externalId: string }>).map((c) => ({ type: c.type, externalId: c.externalId }));
    console.log(`[ScheduleChanged] usuario=${e.userId} cambios=${changes.length}`);
    await audit.record({
      actorId: 'system', action: 'SCHEDULE_CHANGED', entity: 'schedule',
      detail: { userId: e.userId, semester: e.semester, changes },
    });
  });
}
