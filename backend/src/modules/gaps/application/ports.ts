import { Weekday } from '../../schedule/domain/types';

export type GapStatus = 'OCCUPIED' | 'AVAILABLE';
export interface GapKey { weekday: Weekday; startTime: string; endTime: string }
export interface GapActivityRecord extends GapKey { id: string; title: string }
export interface GapSlotRecord extends GapKey { status: GapStatus }

/**
 * PATRÓN Repository: persistencia de las actividades y el estado de los huecos de un estudiante.
 *
 * @pattern Repository | Puerto de actividades y estado de huecos | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás.
 */
export interface GapRepository {
  listActivities(userId: string): Promise<GapActivityRecord[]>;
  listSlots(userId: string): Promise<GapSlotRecord[]>;
  findActivity(userId: string, key: GapKey): Promise<GapActivityRecord | null>;
  /** Crea la actividad del hueco; `null` si el hueco ya tenía una (una sola actividad por hueco: restricción única en BD). */
  createActivity(userId: string, key: GapKey, title: string): Promise<GapActivityRecord | null>;
  /** Cambia el título; `null` si el hueco no tiene actividad. */
  updateActivity(userId: string, key: GapKey, title: string): Promise<GapActivityRecord | null>;
  deleteActivity(userId: string, key: GapKey): Promise<boolean>;
  upsertSlot(userId: string, key: GapKey, status: GapStatus): Promise<void>;
}
