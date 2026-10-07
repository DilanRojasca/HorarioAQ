import { describe, it, expect } from 'vitest';
import { assertCanView } from '../../../src/modules/schedule/domain/access';

describe('assertCanView', () => {
  it('permite ver el propio horario', () => {
    expect(() => assertCanView({ id: 'a', role: 'STUDENT' }, 'a')).not.toThrow();
  });
  it('estudiante no puede ver a otro', () => {
    expect(() => assertCanView({ id: 'a', role: 'STUDENT' }, 'b')).toThrow(/propio horario/);
  });
  it('admin puede ver a otro', () => {
    expect(() => assertCanView({ id: 'x', role: 'ADMIN' }, 'b')).not.toThrow();
  });
});
