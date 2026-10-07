import { describe, it, expect } from 'vitest';
import { InMemoryEventBus } from '../../src/shared/eventBus';
import { registerAuditListener } from '../../src/modules/audit/auditListener';
import { RecordingAudit } from '../helpers/inMemory';

describe('auditListener', () => {
  it('audita ScheduleChanged con tipo y cantidad de cambios', async () => {
    const bus = new InMemoryEventBus();
    const audit = new RecordingAudit();
    registerAuditListener(bus, audit);
    bus.publish({ type: 'ScheduleChanged', userId: 'u1', semester: '2026-2', changes: [{ type: 'UPDATED', externalId: 'e1' }] });
    await new Promise((r) => setTimeout(r, 0));
    expect(audit.entries[0]).toMatchObject({
      action: 'SCHEDULE_CHANGED', entity: 'schedule', actorId: 'system',
      detail: { userId: 'u1', semester: '2026-2', changes: [{ type: 'UPDATED', externalId: 'e1' }] },
    });
  });
});
