import { api } from '../../shared/api';

export type GapStatus = 'OCCUPIED' | 'AVAILABLE';
export interface Suggestion { kind: 'REST' | 'MEAL' | 'STUDY'; title: string; detail: string }
export interface GapKey { weekday: number; startTime: string; endTime: string }
export interface Gap extends GapKey {
  minutes: number; status: GapStatus; activity: { id: string; title: string } | null; suggestion: Suggestion | null;
}

export const listGaps = () => api.get<Gap[]>('/gaps');
/** CRUD de actividades de huecos (RF-HUE-03): POST crea (201, 409 si ya existe o el hueco está ocupado), PUT actualiza, DELETE elimina. */
export const createActivity = (k: GapKey, title: string) => api.post('/gaps/activities', { ...k, title });
export const updateActivity = (k: GapKey, title: string) => api.put('/gaps/activities', { ...k, title });
export const removeActivity = (k: GapKey) => api.del('/gaps/activities', k);
export const setGapStatus = (k: GapKey, status: GapStatus) => api.put('/gaps/status', { ...k, status });
