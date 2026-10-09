import { useEffect, useId, useRef, useState } from 'react';
import { relativeTime } from './relativeTime';
import { useNotifications } from './useNotifications';

const actionBtn =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-label-md font-semibold text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:text-on-surface-variant disabled:opacity-70';

/** Campana del encabezado: contador de no leídas y panel anclado con la lista. Solo para estudiantes. */
export default function NotificationBell() {
  const { items, unread, loading, error, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: Event) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = () => { setOpen(false); buttonRef.current?.focus(); };
  const announce = unread === 0 ? '' : unread === 1 ? '1 notificación sin leer' : `${unread} notificaciones sin leer`;

  return (
    <div
      ref={rootRef}
      className="sm:relative"
      onBlur={(e) => {
        // El foco salió por teclado a otro elemento de la página: se cierra (relatedTarget nulo = clic en zona no enfocable).
        if (open && e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Notificaciones, ${unread} sin leer`}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-outline-variant/30 bg-primary text-on-primary hover:bg-surface-tint focus-visible:ring-white focus-visible:ring-offset-primary-container"
      >
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
          {unread > 0 ? 'notifications_active' : 'notifications'}
        </span>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary-container px-1 text-label-sm text-on-secondary-container"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>

      {open && (
        <section
          id={panelId}
          role="region"
          aria-labelledby={titleId}
          className="fixed inset-x-2 top-[72px] z-50 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-[10px] border border-outline-variant bg-surface-container-lowest text-on-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[24rem]"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low/60 py-1 pl-4 pr-1">
            <h2 id={titleId} className="m-0 text-title-md text-on-surface">Notificaciones</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar notificaciones"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          {error && (
            <p role="alert" className="m-2 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-body-md font-medium text-error">{error}</p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="m-0 p-4 text-body-md text-on-surface-variant">Cargando notificaciones…</p>
            ) : items.length === 0 ? (
              <p className="m-0 p-4 text-body-md text-on-surface-variant">No tienes notificaciones</p>
            ) : (
              <ul role="list" className="m-0 list-none divide-y divide-outline-variant/60 p-0">
                {items.map((n) => (
                  <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.readAt ? '' : 'bg-surface-container-low/50'}`}>
                    <span className="mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                      {!n.readAt && (
                        <>
                          <span className="h-2.5 w-2.5 rounded-full bg-secondary" aria-hidden="true" />
                          <span className="sr-only">Sin leer</span>
                        </>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`m-0 break-words text-title-sm text-on-surface ${n.readAt ? 'font-medium' : ''}`}>{n.title}</p>
                      <p className="m-0 mt-0.5 break-words text-body-md text-on-surface-variant">{n.message}</p>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
                        <time dateTime={n.createdAt} className="text-body-sm text-on-surface-variant">{relativeTime(n.createdAt)}</time>
                        {!n.readAt && (
                          <button type="button" onClick={() => markRead(n.id)} aria-label={`Marcar leída: ${n.title}`} className={`${actionBtn} -mr-3`}>
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mark_email_read</span>
                            Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-outline-variant px-2 py-1">
            <button type="button" onClick={() => markAllRead()} disabled={unread === 0} className={`${actionBtn} w-full`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">done_all</span>
              Marcar todas como leídas
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
