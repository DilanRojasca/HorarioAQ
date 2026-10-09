const rtf = new Intl.RelativeTimeFormat('es-CO', { numeric: 'always' });

/** "hace 5 minutos", "hace 3 horas"…; pasada una semana, la fecha en es-CO. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const seconds = Math.round((now - t) / 1000);
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(t).toLocaleDateString('es-CO');
}
