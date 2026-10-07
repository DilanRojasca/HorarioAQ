import { describe, it, expect, vi } from 'vitest';
import { withAudit } from '../../src/shared/audit';

describe('withAudit', () => {
  const inner = { execute: vi.fn(async (n: number) => n * 2) };

  it('registra auditoría tras ejecutar el caso de uso', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const uc = withAudit(audit, 'DOBLAR', inner, {
      entity: 'num', actorOf: () => 'u1', detailOf: (i, o) => ({ i, o }),
    });
    expect(await uc.execute(2)).toBe(4);
    expect(audit.record).toHaveBeenCalledWith({ actorId: 'u1', action: 'DOBLAR', entity: 'num', detail: { i: 2, o: 4 } });
  });

  it('respeta shouldAudit=false', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const uc = withAudit(audit, 'A', inner, { entity: 'e', actorOf: () => 'u', shouldAudit: () => false });
    await uc.execute(1);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no audita si el caso de uso lanza', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const failing = { execute: async () => { throw new Error('x'); } };
    const uc = withAudit(audit, 'A', failing, { entity: 'e', actorOf: () => 'u' });
    await expect(uc.execute(1)).rejects.toThrow('x');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('con auditFailures registra <acción>_FAILED con el mensaje y relanza', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const failing = { execute: async () => { throw new Error('boom'); } };
    const uc = withAudit(audit, 'SYNC', failing, { entity: 'e', actorOf: () => 'u', auditFailures: true });
    await expect(uc.execute(1)).rejects.toThrow('boom');
    expect(audit.record).toHaveBeenCalledWith({ actorId: 'u', action: 'SYNC_FAILED', entity: 'e', detail: { message: 'boom' } });
  });

  it('con auditFailures y éxito solo registra la acción normal', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const uc = withAudit(audit, 'SYNC', inner, { entity: 'e', actorOf: () => 'u', auditFailures: true });
    await uc.execute(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'SYNC' }));
  });
});
