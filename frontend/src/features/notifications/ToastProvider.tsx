import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning';
export interface ToastInput { title: string; message?: string; tone?: ToastTone }
interface ToastItem extends ToastInput { id: number }

const AUTO_CLOSE_MS = 6000;
const MAX_VISIBLE = 3;
const NOOP = { toast: (_t: ToastInput) => {} };

const ToastCtx = createContext<{ toast(t: ToastInput): void } | null>(null);

const TONES: Record<ToastTone, { bar: string; icon: string }> = {
  info: { bar: 'border-l-primary', icon: 'text-primary' },
  success: { bar: 'border-l-[#1E7E34]', icon: 'text-[#1E7E34]' },
  warning: { bar: 'border-l-secondary-container', icon: 'text-secondary' },
};

function Toast({ item, onClose }: { item: ToastItem; onClose(id: number): void }) {
  const [paused, setPaused] = useState(false);
  const tone = item.tone ?? 'info';
  const isSuccess = tone === 'success';
  const isWarning = tone === 'warning';
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => onClose(item.id), AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [paused, item.id, onClose]);

  return (
    <div
      data-toast
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex items-start gap-2.5 rounded-[10px] border border-l-4 border-outline-variant bg-surface-container-lowest py-2 pl-3 pr-1 shadow-lg motion-safe:animate-toast-in ${TONES[tone].bar}`}
    >
      <span className={`material-symbols-outlined mt-2.5 text-[20px] ${TONES[tone].icon}`} aria-hidden="true">
        {isSuccess ? 'check_circle' : isWarning ? 'warning' : 'info'}
      </span>
      <div className="min-w-0 flex-1 py-2">
        <p className="m-0 break-words text-title-sm text-on-surface">{item.title}</p>
        {item.message && <p className="m-0 mt-0.5 break-words text-body-md text-on-surface-variant">{item.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        aria-label="Cerrar aviso"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
      </button>
    </div>
  );
}

/** Avisos efímeros. La región `role="status"` está siempre montada para que los lectores de pantalla anuncien los nuevos. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const close = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: ToastInput) => {
    setItems((prev) => [...prev, { ...t, id: nextId.current++ }].slice(-MAX_VISIBLE));
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
      >
        {items.map((t) => <Toast key={t.id} item={t} onClose={close} />)}
      </div>
    </ToastCtx.Provider>
  );
}

/** Sin proveedor no hace nada, así los componentes se pueden probar de forma aislada. */
export function useToast() {
  return useContext(ToastCtx) ?? NOOP;
}
