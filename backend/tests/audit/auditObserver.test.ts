import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { registerAuditObserver } from '../../src/modules/audit/auditObserver';
import { RecordingAudit } from '../helpers/inMemory';
import type { ScheduleChange } from '../../src/modules/schedule/domain/types';

describe('auditObserver', () => {
  it('audita ScheduleChanged con tipo y cantidad de cambios', async () => {
    const bus = new EventBus({ sleep: async () => {} });
    const audit = new RecordingAudit();
    registerAuditObserver(bus, audit);
    const changes = [{ type: 'UPDATED', externalId: 'e1', userId: 'u1' }] as ScheduleChange[];
    await bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes, initialLoad: false });
    expect(audit.entries[0]).toMatchObject({
      action: 'SCHEDULE_CHANGED', entity: 'schedule', actorId: 'system',
      detail: { userId: 'u1', semester: '2026-2', changes: [{ type: 'UPDATED', externalId: 'e1' }] },
    });
  });
});
