export interface SendWindowOptions {
  /** Hora local de inicio, inclusiva (0-23). */
  start?: number;
  /** Hora local de fin, exclusiva (0-24). */
  end?: number;
  /** Zona horaria IANA. */
  timeZone?: string;
}

/** ¿La hora local de `timeZone` cae en `start <= hora < end`? (ventana de envío, RRF-05). */
export function isWithinSendWindow(date: Date, opts: SendWindowOptions = {}): boolean {
  const { start = 6, end = 22, timeZone = 'America/Bogota' } = opts;
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date),
  );
  return hour >= start && hour < end;
}
