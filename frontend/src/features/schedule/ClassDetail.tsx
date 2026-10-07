import { useEffect, useRef } from 'react';
import { WEEKDAYS } from './grid';
import type { Session } from './types';

export default function ClassDetail({ session, onClose }: { session: Session; onClose(): void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, onClose]);

  return (
    <section ref={ref} tabIndex={-1} className="card detail" aria-labelledby="detail-title" role="region">
      <h2 id="detail-title">{session.courseName}</h2>
      <dl>
        <dt>Código</dt><dd>{session.courseCode}</dd>
        <dt>Docente</dt><dd>{session.teacher}</dd>
        <dt>Día</dt><dd>{WEEKDAYS.find((d) => d.n === session.weekday)?.label}</dd>
        <dt>Franja</dt><dd>{session.startTime} – {session.endTime}</dd>
        <dt>Bloque</dt><dd>{session.block}</dd>
        <dt>Piso</dt><dd>{session.floor}</dd>
        <dt>Aula</dt><dd>{session.room}</dd>
      </dl>
      <p><button className="btn secondary" onClick={onClose}>Cerrar detalle</button></p>
    </section>
  );
}
