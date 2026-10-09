import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { getToken } from './api';
import { RealtimeClient } from './realtime';
import type { RealtimeSource } from './realtime';

const RealtimeCtx = createContext<RealtimeSource | null>(null);

/** Mantiene un único `RealtimeClient` activo mientras haya sesión. `client` permite inyectar un doble en pruebas. */
export function RealtimeProvider({ children, client }: { children: ReactNode; client?: RealtimeSource }) {
  const { user } = useAuth();
  const active = useMemo<RealtimeSource>(
    () => client ?? new RealtimeClient({ getToken }),
    [client],
  );
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    active.start();
    return () => active.stop();
  }, [active, userId]);
  return <RealtimeCtx.Provider value={active}>{children}</RealtimeCtx.Provider>;
}

/** Se suscribe a un tipo de evento mientras el componente está montado; usa siempre la última versión del manejador. */
export function useRealtime(type: string, handler: (data: unknown) => void): void {
  const source = useContext(RealtimeCtx);
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!source) return;
    return source.subscribe(type, (data) => latest.current(data));
  }, [source, type]);
}
