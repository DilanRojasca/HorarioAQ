import '../../../shared/openapi/extend';
import { z } from 'zod';

export const uuid = z.string().uuid('Identificador inválido').openapi({ example: '3f2b8c1e-5a4d-4b7e-9c10-2d6a8e7f1b34' });
export const facultyBody = z.object({ name: z.string().openapi({ example: 'Facultad de Ingeniería' }) }).strict().openapi('CreateFacultyRequest');
export const programBody = z.object({ code: z.string().openapi({ example: 'ISI' }), name: z.string().openapi({ example: 'Ingeniería de Sistemas' }), facultyId: uuid }).strict().openapi('CreateProgramRequest');
export const programUpdateBody = z.object({ name: z.string().optional(), facultyId: uuid.optional() }).strict().openapi('UpdateProgramRequest');
