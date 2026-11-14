import { api } from '../../shared/api';

export type GapStatus = 'OCCUPIED' | 'AVAILABLE';
export interface Suggestion { kind: 'REST' | 'MEAL' | 'STUDY'; title: string; detail: string }
export interface GapKey { weekday: number; startTime: string; endTime: string }
export interface Gap extends GapKey {
  minutes: number; status: GapStatus; activity: { id: string; title: string } | null; suggestion: Suggestion | null;
}

export const listGaps = () => api.get<Gap[]>('/gaps');
export const assignActivity = (k: GapKey, title: string) => api.put('/gaps/activity', { ...k, title });
export const removeActivity = (k: GapKey) => api.del('/gaps/activity', k);
export const setGapStatus = (k: GapKey, status: GapStatus) => api.put('/gaps/status', { ...k, status });
