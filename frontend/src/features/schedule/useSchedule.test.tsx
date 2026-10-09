import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSchedule } from './useSchedule';
import { api } from '../../shared/api';

vi.mock('../../shared/api', async (orig) => {
  const actual = await orig<typeof import('../../shared/api')>();
  return { ...actual, api: { get: vi.fn() } };
});
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const result = (semester: string) => ({ userId: 'u', semester, enrolled: true, sessions: [] });

describe('useSchedule', () => {
  beforeEach(() => { get.mockReset(); });

  it('dos recargas rápidas: una respuesta más vieja no sobrescribe a la más nueva', async () => {
    get.mockResolvedValueOnce(result('inicial'));
    const { result: hook } = renderHook(() => useSchedule());
    await waitFor(() => expect(hook.current.data?.semester).toBe('inicial'));

    const resolvers: Array<(v: unknown) => void> = [];
    get.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    let p1!: Promise<void>; let p2!: Promise<void>;
    act(() => { p1 = hook.current.refetch(); p2 = hook.current.refetch(); });
    await act(async () => { resolvers[1](result('nuevo')); await p2; });
    await act(async () => { resolvers[0](result('viejo')); await p1; });
    expect(hook.current.data?.semester).toBe('nuevo');
  });

  it('una recarga fallida conserva los datos y no marca error', async () => {
    get.mockResolvedValueOnce(result('ok'));
    const { result: hook } = renderHook(() => useSchedule());
    await waitFor(() => expect(hook.current.data).not.toBeNull());
    get.mockRejectedValueOnce(new Error('red'));
    await act(async () => { await hook.current.refetch(); });
    expect(hook.current.error).toBe('');
    expect(hook.current.data?.semester).toBe('ok');
  });
});
