import '../../../shared/openapi/extend';
import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)').openapi({ example: '10:00' });

/** Un hueco se identifica por día + franja (los huecos se calculan al vuelo, no tienen ID). */
export const gapKey = z.object({
  weekday: z.number().int().min(1).max(7).openapi({ example: 3 }),
  startTime: time,
  endTime: time.openapi({ example: '14:00' }),
}).openapi('GapKey');

export const activityBody = gapKey.extend({ title: z.string().openapi({ example: 'Biblioteca', description: '1–80 caracteres.' }) }).strict().openapi('GapActivityRequest');
export const statusBody = gapKey.extend({ status: z.enum(['OCCUPIED', 'AVAILABLE']) }).strict().openapi('SetGapStatusRequest');
