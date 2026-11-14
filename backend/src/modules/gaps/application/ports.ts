import { Weekday } from '../../schedule/domain/types';

export type GapStatus = 'OCCUPIED' | 'AVAILABLE';
export interface GapKey { weekday: Weekday; startTime: string; endTime: string }
export interface GapActivityRecord extends GapKey { id: string; title: string }
export interface GapSlotRecord extends GapKey { status: GapStatus }

/** PATRÓN Repository: persistencia de las actividades y el estado de los huecos de un estudiante. */
export interface GapRepository {
  listActivities(userId: string): Promise<GapActivityRecord[]>;
  listSlots(userId: string): Promise<GapSlotRecord[]>;
  /** Una actividad por hueco: reemplaza la existente. */
  upsertActivity(userId: string, key: GapKey, title: string): Promise<GapActivityRecord>;
  deleteActivity(userId: string, key: GapKey): Promise<boolean>;
  upsertSlot(userId: string, key: GapKey, status: GapStatus): Promise<void>;
}
