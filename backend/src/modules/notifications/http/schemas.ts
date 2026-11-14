import '../../../shared/openapi/extend';
import { z } from 'zod';

export const uuid = z.string().uuid('Identificador inválido').openapi({ example: '3f2b8c1e-5a4d-4b7e-9c10-2d6a8e7f1b34' });

export const listQuery = z.object({
  unread: z.enum(['1', '0', 'true', 'false']).optional().openapi({ description: 'Solo no leídas.' }),
  limit: z.coerce.number({ invalid_type_error: 'limit inválido' }).int('limit debe ser entero')
    .min(1, 'limit mínimo 1').max(100, 'limit máximo 100').default(30),
});

export const scheduleBody = z.object({
  title: z.string().openapi({ example: 'Parcial de Cálculo' }),
  message: z.string().openapi({ example: 'Repasar los capítulos 3 y 4' }),
  fireAt: z.coerce.date({ errorMap: () => ({ message: 'Fecha y hora inválidas' }) }).openapi({ type: 'string', format: 'date-time', example: '2026-11-20T14:00:00.000Z', description: 'Debe ser futura.' }),
  sessionExternalId: z.string().max(120).optional().openapi({ description: 'Clase de tu horario a la que se asocia.' }),
}).strict().openapi('ScheduleNotificationRequest');

export const prefsBody = z.object({
  notifyChannel: z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional(),
  reminderMinutes: z.number().int().optional().openapi({ example: 15, description: 'Entre 5 y 120 minutos.' }),
}).strict().openapi('PreferencesRequest');
