import { useCallback, useEffect, useRef, useState } from 'react';
import { listGaps } from '../gaps/api';
import { toGapBlocks } from './gapBlocks';
import type { GapBlock } from './gapBlocks';

/**
 * Carga las actividades y huecos ocupados del estudiante para pintarlos en el calendario.
 * Si falla, el calendario sigue mostrando las clases (los huecos son un complemento, no deben romper la pantalla).
 *
 * @pattern Custom Hook | Datos de los huecos del calendario | Separa la obtención de datos de la presentación del calendario.
 */
export function useGapBlocks() {
  const [blocks, setBlocks] = useState<GapBlock[]>([]);
  const alive = useRef(true);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const gaps = await listGaps();
      if (alive.current && mine === seq.current && Array.isArray(gaps)) setBlocks(toGapBlocks(gaps));
    } catch { /* el calendario sigue sin los huecos */ }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => { alive.current = false; };
  }, [reload]);

  return { blocks, reload };
}
