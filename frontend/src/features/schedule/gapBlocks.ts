import type { Gap } from '../gaps/api';

/**
 * Lo que se pinta en el calendario de los huecos (RF-HUE-03/04): solo los que el estudiante TOCÓ, es decir, los que tienen una
 * actividad propia o fueron marcados como ocupados. Los huecos libres sin tocar no ocupan espacio en el calendario.
 */
export interface GapBlock { weekday: number; startTime: string; endTime: string; title: string | null; occupied: boolean }

export function toGapBlocks(gaps: Gap[]): GapBlock[] {
  return gaps
    .filter((g) => g.activity !== null || g.status === 'OCCUPIED')
    .map((g) => ({ weekday: g.weekday, startTime: g.startTime, endTime: g.endTime, title: g.activity?.title ?? null, occupied: g.status === 'OCCUPIED' }));
}

export const gapLabel = (b: GapBlock) => (b.title ? b.title : 'Ocupado');
export const gapKey = (b: GapBlock) => `gap-${b.weekday}-${b.startTime}-${b.endTime}`;

export function gapBlocksByDay(blocks: GapBlock[]): Record<number, GapBlock[]> {
  const out: Record<number, GapBlock[]> = {};
  for (const b of blocks) (out[b.weekday] ??= []).push(b);
  for (const k of Object.keys(out)) out[+k].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return out;
}
