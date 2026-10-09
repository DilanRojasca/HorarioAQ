import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtime } from '../../shared/RealtimeProvider';
import { listNotifications, markAllRead as markAllReadApi, markRead as markReadApi } from './api';
import type { AppNotification } from './api';
import { useToast } from './ToastProvider';

const LIMIT = 20;

interface Data { items: AppNotification[]; unread: number }
interface LivePayload { id: string; title: string; message: string; kind: string }
const isLive = (d: unknown): d is LivePayload =>
  typeof d === 'object' && d !== null && typeof (d as LivePayload).id === 'string' && typeof (d as LivePayload).title === 'string';

/** Estado de las notificaciones del usuario: carga inicial, eventos `notification` en vivo y marcado como leídas. */
export function useNotifications() {
  const [data, setData] = useState<Data>({ items: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();
  // Espejo síncrono de `data`: las transiciones se calculan sobre él para no depender del momento en que React ejecute los actualizadores.
  const current = useRef(data);
  const alive = useRef(true);
  const seq = useRef(0);
  // Ids llegados por eventos en vivo desde que empezó la última recarga.
  const liveSince = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const update = useCallback((fn: (d: Data) => Data) => {
    current.current = fn(current.current);
    setData(current.current);
  }, []);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    liveSince.current = new Set();
    const live = liveSince.current;
    try {
      const r = await listNotifications({ limit: LIMIT });
      if (!alive.current || mine !== seq.current) return; // respuesta obsoleta: gana la última
      // Solo se conservan las que llegaron en vivo durante esta carga y el servidor aún no devuelve.
      update((d) => {
        const ids = new Set(r.items.map((i) => i.id));
        const extra = d.items.filter((i) => live.has(i.id) && !ids.has(i.id));
        return { items: [...extra, ...r.items], unread: r.unread + extra.filter((i) => !i.readAt).length };
      });
      setError('');
    } catch (e) {
      if (alive.current && mine === seq.current) setError(e instanceof Error ? e.message : 'No se pudieron cargar las notificaciones');
    } finally {
      if (alive.current && mine === seq.current) setLoading(false);
    }
  }, [update]);
  useEffect(() => { void reload(); }, [reload]);

  // `ready` llega en cada conexión: al reconectar se recupera lo emitido mientras el flujo estaba caído.
  useRealtime('ready', () => { void reload(); });

  useRealtime('notification', (payload) => {
    if (!isLive(payload) || current.current.items.some((i) => i.id === payload.id)) return;
    const incoming: AppNotification = {
      id: payload.id, kind: payload.kind, title: payload.title, message: payload.message,
      createdAt: new Date().toISOString(), readAt: null,
    };
    liveSince.current.add(incoming.id);
    update((d) => ({ items: [incoming, ...d.items], unread: d.unread + 1 }));
    toast({ title: payload.title, message: payload.message, tone: 'info' });
  });

  const markRead = useCallback(async (id: string) => {
    try {
      await markReadApi(id);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'No se pudo marcar como leída');
      return;
    }
    update((d) => {
      const target = d.items.find((i) => i.id === id);
      if (!target || target.readAt) return d;
      const now = new Date().toISOString();
      return { items: d.items.map((i) => (i.id === id ? { ...i, readAt: now } : i)), unread: Math.max(0, d.unread - 1) };
    });
    setError('');
  }, [update]);

  const markAllRead = useCallback(async () => {
    try {
      await markAllReadApi();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'No se pudieron marcar como leídas');
      return;
    }
    const now = new Date().toISOString();
    update((d) => ({ items: d.items.map((i) => (i.readAt ? i : { ...i, readAt: now })), unread: 0 }));
    setError('');
  }, [update]);

  return { items: data.items, unread: data.unread, loading, error, markRead, markAllRead, reload };
}
