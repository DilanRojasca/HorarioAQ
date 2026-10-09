import { describe, it, expect } from 'vitest';
import { ConsoleEmailAdapter } from '../../src/modules/notifications/infrastructure/ConsoleEmailAdapter';

describe('ConsoleEmailAdapter', () => {
  it('imprime destinatario y asunto', async () => {
    const lines: string[] = [];
    await new ConsoleEmailAdapter((l) => lines.push(l)).send({ to: 'a@horariouni.test', subject: 'Hola', text: 'cuerpo' });
    expect(lines).toEqual(['[email:console] para=a@horariouni.test asunto=Hola']);
  });

  it('no imprime el cuerpo largo del mensaje', async () => {
    const lines: string[] = [];
    const text = 'x'.repeat(500);
    await new ConsoleEmailAdapter((l) => lines.push(l)).send({ to: 'a@b.test', subject: 'S', text });
    expect(lines.join('\n')).not.toContain('x'.repeat(121));
  });
});
