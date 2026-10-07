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
});
