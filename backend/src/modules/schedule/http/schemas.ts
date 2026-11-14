import '../../../shared/openapi/extend';
import { z } from 'zod';

export const uuid = z.string().uuid('Identificador inválido').openapi({ example: '3f2b8c1e-5a4d-4b7e-9c10-2d6a8e7f1b34' });

/** RF-BUS-01/02: filtros del horario (se traducen a Specifications en el dominio). */
export const scheduleQuery = z.object({
  q: z.string().max(80).optional().openapi({ example: 'algoritmos', description: 'Nombre o código de la asignatura (sin tildes ni mayúsculas).' }),
  weekday: z.coerce.number().int().min(1).max(7).optional().openapi({ example: 1, description: '1 = lunes … 7 = domingo.' }),
  block: z.string().max(10).optional().openapi({ example: 'B' }),
  teacher: z.string().max(80).optional().openapi({ example: 'Julia' }),
});

export const exportQuery = z.object({
  format: z.enum(['ics', 'pdf'], { errorMap: () => ({ message: 'Formato inválido (ics|pdf)' }) }).openapi({ description: '`ics` (Google Calendar / Outlook) o `pdf`.' }),
});

export const sessionDetailQuery = z.object({
  userId: uuid.optional().openapi({ description: 'Solo ADMIN: dueño de la clase (queda auditado).' }),
});

export const eventsQuery = z.object({
  limit: z.coerce.number({ invalid_type_error: 'limit inválido' }).int('limit inválido').min(1, 'limit mínimo 1').max(100, 'limit máximo 100').default(20),
});

export const testEventBody = z.object({
  kind: z.enum(['ADDED', 'UPDATED', 'CANCELLED']).default('ADDED').openapi({ description: 'Tipo de cambio ficticio a publicar.' }),
  userId: z.string().uuid('userId inválido').optional().openapi({ description: 'Estudiante destino (por defecto, el propio admin).' }),
}).openapi('TestEventRequest');

export const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(60).optional().openapi({ example: 'LOGIN' }),
});

export const roleBody = z.object({ role: z.enum(['STUDENT', 'ADMIN']) }).strict().openapi('ChangeRoleRequest');
