import { EmailMessage, EmailPort } from '../application/ports';

/** Adaptador de desarrollo: escribe destinatario y asunto en el log; nunca el cuerpo completo. */
export class ConsoleEmailAdapter implements EmailPort {
  constructor(private readonly log: (line: string) => void = console.log) {}

  async send(msg: EmailMessage): Promise<void> {
    this.log(`[email:console] para=${msg.to} asunto=${msg.subject.slice(0, 120)}`);
  }
}
