import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { useNotifications } from './useNotifications';
import { ToastProvider } from './ToastProvider';
import { RealtimeProvider } from '../../shared/RealtimeProvider';
import { FakeRealtime } from '../../shared/fakeRealtime';
import * as api from './api';

vi.mock('./api', () => ({ listNotifications: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Dilan', email: 'd@x.co', role: 'STUDENT' } }),
}));

const list = vi.mocked(api.listNotifications);
const markReadApi = vi.mocked(api.markRead);
const markAllApi = vi.mocked(api.markAllRead);

const n = (id: string, over: object = {}) => ({
  id, userId: 'u', kind: 'UPDATED', title: `Título ${id}`, message: `Mensaje ${id}`,
  createdAt: '2026-10-09T12:00:00.000Z', readAt: null, emailedAt: null, ...over,
});

let fake: FakeRealtime;
function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider><RealtimeProvider client={fake}>{children}</RealtimeProvider></ToastProvider>;
}

describe('useNotifications', () => {
  beforeEach(() => {
    fake = new FakeRealtime();
    list.mockReset(); markReadApi.mockReset(); markAllApi.mockReset();
    list.mockResolvedValue({ items: [n('a'), n('b', { readAt: '2026-10-09T13:00:00.000Z' })], unread: 1 });
    markReadApi.mockResolvedValue(undefined);
    markAllApi.mockResolvedValue({ updated: 1 });
  });

  it('carga la lista inicial y el contador', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(result.current.unread).toBe(1);
    expect(result.current.error).toBe('');
  });

  it('expone el error de carga', async () => {
    list.mockRejectedValue(new Error('Sin conexión'));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('Sin conexión'));
    expect(result.current.loading).toBe(false);
  });

  it('un evento en vivo antepone la notificación, sube el contador y muestra un aviso con el título', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => fake.emit('notification', { id: 'c', title: 'Aula nueva', message: 'Ahora en 305', kind: 'UPDATED' }));
    expect(result.current.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(result.current.items[0]).toMatchObject({ title: 'Aula nueva', message: 'Ahora en 305', readAt: null });
    expect(result.current.unread).toBe(2);
    expect(screen.queryByText('Aula nueva')).not.toBeNull();
  });

  it('no duplica por id si el evento ya está en la lista', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => fake.emit('notification', { id: 'a', title: 'Título a', message: 'Mensaje a', kind: 'UPDATED' }));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unread).toBe(1);
  });

  it('un evento anterior a la carga inicial se conserva sin duplicarse', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof api.listNotifications>>) => void;
    list.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => fake.emit('notification', { id: 'z', title: 'Z', message: 'm', kind: 'ADDED' }));
    await act(async () => { resolve({ items: [n('z'), n('a')], unread: 2 }); });
    expect(result.current.items.map((i) => i.id)).toEqual(['z', 'a']);
    expect(result.current.unread).toBe(2);
  });

  it('markRead marca una sola y baja el contador (sin bajar de 0 ni repetir)', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.markRead('a'); });
    expect(markReadApi).toHaveBeenCalledWith('a');
    expect(result.current.items[0].readAt).not.toBeNull();
    expect(result.current.unread).toBe(0);
    await act(async () => { await result.current.markRead('a'); });
    expect(result.current.unread).toBe(0);
  });

  it('markAllRead deja todo leído y el contador en 0', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.markAllRead(); });
    expect(markAllApi).toHaveBeenCalled();
    expect(result.current.items.every((i) => i.readAt)).toBe(true);
    expect(result.current.unread).toBe(0);
  });

  it('si marcar falla conserva el estado y expone el error', async () => {
    markReadApi.mockRejectedValue(new Error('No se pudo marcar'));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.markRead('a'); });
    expect(result.current.unread).toBe(1);
    expect(result.current.error).toBe('No se pudo marcar');
  });

  it('recarga al (re)conectar el flujo (evento ready) y con reload()', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => { fake.emit('ready', {}); });
    expect(list).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.reload(); });
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('no hace nada con schedule-changed (lo maneja la página)', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => fake.emit('schedule-changed', { semester: '2026-2', count: 1 }));
    expect(result.current.items).toHaveLength(2);
    expect(list).toHaveBeenCalledTimes(1);
  });

  const window20 = (prefix: string, count = 20) => Array.from({ length: count }, (_, i) => n(`${prefix}${i + 1}`));

  it('ready con más de 20 notificaciones: la lista queda igual a la ventana del servidor, sin item viejo antepuesto y con el contador del servidor', async () => {
    list.mockResolvedValueOnce({ items: window20('i'), unread: 25 });
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => fake.emit('notification', { id: 'L', title: 'Viva', message: 'm', kind: 'ADDED' }));
    expect(result.current.unread).toBe(26);
    const serverWindow = [n('L'), ...window20('i', 19)]; // i20 salió de la ventana
    list.mockResolvedValueOnce({ items: serverWindow, unread: 26 });
    await act(async () => { fake.emit('ready', {}); });
    expect(result.current.items.map((i) => i.id)).toEqual(serverWindow.map((i) => i.id));
    expect(result.current.unread).toBe(26);
  });

  it('una notificación en vivo durante una recarga en curso se conserva y cuenta una sola vez', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let resolve!: (v: Awaited<ReturnType<typeof api.listNotifications>>) => void;
    list.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.reload(); });
    act(() => fake.emit('notification', { id: 'X', title: 'X', message: 'm', kind: 'ADDED' }));
    await act(async () => { resolve({ items: [n('a'), n('b')], unread: 1 }); await pending; });
    expect(result.current.items.map((i) => i.id)).toEqual(['X', 'a', 'b']);
    expect(result.current.unread).toBe(2);
  });

  it('si el servidor ya devuelve la notificación en vivo no se duplica ni se cuenta de nuevo', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let resolve!: (v: Awaited<ReturnType<typeof api.listNotifications>>) => void;
    list.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.reload(); });
    act(() => fake.emit('notification', { id: 'X', title: 'X', message: 'm', kind: 'ADDED' }));
    await act(async () => { resolve({ items: [n('X'), n('a')], unread: 2 }); await pending; });
    expect(result.current.items.map((i) => i.id)).toEqual(['X', 'a']);
    expect(result.current.unread).toBe(2);
  });

  it('una recarga sin eventos en vivo reemplaza el estado por la respuesta del servidor', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    list.mockResolvedValueOnce({ items: [n('c')], unread: 0 });
    await act(async () => { await result.current.reload(); });
    expect(result.current.items.map((i) => i.id)).toEqual(['c']);
    expect(result.current.unread).toBe(0);
  });

  it('respuestas obsoletas se ignoran: gana la última recarga', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    type R = Awaited<ReturnType<typeof api.listNotifications>>;
    const resolvers: Array<(v: R) => void> = [];
    list.mockImplementation(() => new Promise<R>((r) => { resolvers.push(r); }));
    let p1!: Promise<void>; let p2!: Promise<void>;
    act(() => { p1 = result.current.reload(); p2 = result.current.reload(); });
    await act(async () => { resolvers[1]({ items: [n('nuevo')], unread: 1 }); await p2; });
    await act(async () => { resolvers[0]({ items: [n('viejo')], unread: 9 }); await p1; });
    expect(result.current.items.map((i) => i.id)).toEqual(['nuevo']);
    expect(result.current.unread).toBe(1);
  });
});
