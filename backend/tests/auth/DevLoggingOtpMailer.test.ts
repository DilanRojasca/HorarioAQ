import { describe, it, expect } from 'vitest';
import { DevLoggingOtpMailer } from '../../src/modules/auth/infrastructure/DevLoggingOtpMailer';
import { EmailOtpMailer } from '../../src/modules/auth/infrastructure/EmailOtpMailer';
import { RecordingOtpMailer } from '../helpers/inMemory';

describe('OtpMailer: Adapter + Decorator', () => {
  it('EmailOtpMailer adapta el puerto de correo y el asunto depende del propósito', async () => {
    const sent: { to: string; subject: string; text: string }[] = [];
    const m = new EmailOtpMailer({ send: async (x) => { sent.push(x); } });
    await m.sendOtp({ email: 'a@amigo.edu.co', name: 'Ana' }, '123456', 'RESET');
    expect(sent[0]).toMatchObject({ to: 'a@amigo.edu.co', subject: expect.stringContaining('contraseña') });
    expect(sent[0].text).toContain('123456');
  });
  it('el decorador imprime el código y delega en el mailer real', async () => {
    const lines: string[] = []; const inner = new RecordingOtpMailer();
    await new DevLoggingOtpMailer(inner, (l) => lines.push(l)).sendOtp({ email: 'a@amigo.edu.co', name: 'Ana' }, '654321', 'VERIFY');
    expect(lines[0]).toContain('654321');
    expect(inner.sent).toHaveLength(1);
  });
});
