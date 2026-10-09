import { useEffect, useId, useRef } from 'react';
import { WEEKDAYS } from './grid';
import { durationLabel, initials } from './time';
import type { Session } from './types';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sectionTitle = 'mb-2 flex items-center gap-1.5 text-label-sm uppercase text-on-surface-variant';
const tile = 'rounded-[10px] border border-outline-variant bg-surface-container-low p-3';

export default function ClassDetail({ session, onClose }: { session: Session; onClose(): void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const day = WEEKDAYS.find((d) => d.n === session.weekday)?.label ?? 'Domingo';

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active) || active === panel) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/60 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="detail-overlay"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[10px] border border-outline-variant bg-surface-container-lowest shadow-2xl focus:outline-none sm:rounded-[10px]"
      >
        <div className="h-1 shrink-0 bg-secondary-container" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant bg-surface-container-low/60 px-4 py-3.5">
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-1.5 text-label-sm uppercase text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">school</span>
              Ficha de asignatura
            </p>
            <h2 id={titleId} className="mb-0 mt-1 break-words text-headline-md font-bold text-on-surface">{session.courseName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4">
          <p className="m-0 flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
            Código académico:
            <span className="rounded border border-outline-variant/60 bg-surface-container px-2 py-0.5 font-mono text-body-md font-semibold text-primary">{session.courseCode}</span>
          </p>

          <section aria-labelledby={`${titleId}-when`}>
            <h3 id={`${titleId}-when`} className={sectionTitle}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>
              Horario semanal
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className={tile}>
                <p className="m-0 flex items-center gap-1 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">today</span>Día
                </p>
                <p className="mb-0 mt-1 text-title-md font-bold text-on-surface">{day}</p>
              </div>
              <div className={tile}>
                <p className="m-0 flex items-center gap-1 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">alarm</span>Franja
                </p>
                <p className="mb-0 mt-1 text-title-md font-bold text-on-surface">{session.startTime} – {session.endTime}</p>
              </div>
            </div>
            <p className="mb-0 mt-2 text-body-md text-on-surface-variant">
              Duración por sesión: <strong className="text-on-surface">{durationLabel(session.startTime, session.endTime)}</strong>
            </p>
          </section>

          <section aria-labelledby={`${titleId}-where`}>
            <h3 id={`${titleId}-where`} className={sectionTitle}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">location_on</span>
              Ubicación
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className={tile}>
                <p className="m-0 text-label-sm text-on-surface-variant">Bloque</p>
                <p className="mb-0 mt-1 text-title-md font-bold text-on-surface">{session.block}</p>
              </div>
              <div className={tile}>
                <p className="m-0 text-label-sm text-on-surface-variant">Piso</p>
                <p className="mb-0 mt-1 text-title-md font-bold text-on-surface">{session.floor}</p>
              </div>
              <div className="rounded-[10px] border border-secondary-container/80 bg-surface-container-high p-3">
                <p className="m-0 text-label-sm text-on-surface-variant">Aula</p>
                <p className="mb-0 mt-1 text-title-md font-bold text-on-surface">{session.room}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby={`${titleId}-who`}>
            <h3 id={`${titleId}-who`} className={sectionTitle}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">person</span>
              Docente
            </h3>
            <div className={`${tile} flex items-center gap-3`}>
              <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-label-md font-bold text-on-primary">
                {initials(session.teacher)}
              </span>
              <p className="m-0 min-w-0 break-words text-title-md font-semibold text-on-surface">{session.teacher}</p>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-outline-variant bg-surface px-4 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary-container px-4 font-semibold text-on-primary hover:bg-primary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            Cerrar detalle
          </button>
        </div>
      </div>
    </div>
  );
}
