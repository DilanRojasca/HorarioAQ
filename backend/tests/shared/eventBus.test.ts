import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus } from '../../src/shared/eventBus';

describe('InMemoryEventBus', () => {
  it('entrega el evento a los suscriptores del tipo', async () => {
    const bus = new InMemoryEventBus();
    const h = vi.fn();
    bus.subscribe('X', h);
    bus.publish({ type: 'X', n: 1 });
    bus.publish({ type: 'Y' });
    await new Promise((r) => setTimeout(r, 0));
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({ type: 'X', n: 1 });
  });

  it('un handler que falla no rompe al publicador', async () => {
    const bus = new InMemoryEventBus();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.subscribe('X', () => { throw new Error('boom'); });
    expect(() => bus.publish({ type: 'X' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(err).toHaveBeenCalled();
  });
});
