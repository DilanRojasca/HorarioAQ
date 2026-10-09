import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api';
import type { WeeklyResult } from './types';

export function useSchedule() {
  const [data, setData] = useState<WeeklyResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const hasData = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const d = await api.get<WeeklyResult>('/schedule/me');
      if (!alive.current || mine !== seq.current) return; // respuesta obsoleta: gana la última
      hasData.current = true;
      setData(d);
      setError('');
    } catch (e) {
      // Una recarga fallida no debe reemplazar un horario que ya se estaba mostrando.
      if (alive.current && mine === seq.current && !hasData.current) setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      if (alive.current && mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  /** Vuelve a pedir el horario sin pasar por "Cargando…" (los datos actuales se mantienen hasta que llegan los nuevos). */
  return { data, error, loading, refetch: load };
}
