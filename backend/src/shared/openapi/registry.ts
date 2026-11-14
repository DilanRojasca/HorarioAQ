import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { ZodTypeAny } from 'zod';
import './extend';
import { ErrorResponse } from './schemas';

export const registry = new OpenAPIRegistry();
registry.register('ErrorResponse', ErrorResponse); // asegura que el componente exista aunque ninguna ruta lo use directamente

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
  description: 'Token de acceso obtenido en `POST /auth/login` (dura 60 min). Renuévalo con `POST /auth/refresh`.',
});

/** Respuestas de error reutilizables (`#/components/responses/*`): todas con el mismo cuerpo `ErrorResponse`. */
const ERRORS = {
  400: ['BadRequest', 'Datos inválidos: `issues` lista cada problema de validación.'],
  401: ['Unauthorized', 'Falta el token, es inválido/expiró o la sesión fue cerrada.'],
  403: ['Forbidden', 'La sesión es válida pero su rol no permite esta acción.'],
  404: ['NotFound', 'El recurso no existe (o no es tuyo).'],
  409: ['Conflict', 'El estado actual lo impide (p. ej. correo ya registrado, sincronización en curso).'],
  413: ['PayloadTooLarge', 'El cuerpo supera el límite permitido.'],
  429: ['TooManyRequests', 'Demasiadas solicitudes: revisa las cabeceras `RateLimit-*` y reintenta más tarde.'],
} as const;

for (const [, [name, description]] of Object.entries(ERRORS)) {
  registry.registerComponent('responses', name, { description, content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } });
}

export type ErrorStatus = keyof typeof ERRORS;
export const errorRef = (status: ErrorStatus) => ({ $ref: `#/components/responses/${ERRORS[status][0]}` });

export type Access = 'public' | 'any' | 'student' | 'admin';
const ACCESS_TEXT: Record<Access, string> = {
  public: '**Público** (no requiere token).',
  any: '**Requiere sesión** (cualquier rol).',
  student: '**Solo estudiantes** (rol `STUDENT`).',
  admin: '**Solo administradores** (rol `ADMIN`).',
};

export interface Operation {
  method: 'get' | 'post' | 'put' | 'delete';
  /** Ruta relativa a `/api/v1`, con parámetros `{id}`. */
  path: string;
  tag: string;
  operationId: string;
  summary: string;
  description?: string;
  access: Access;
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  /** Código de éxito (por defecto 200). */
  status?: 200 | 201 | 204;
  response?: ZodTypeAny;
  responseDescription?: string;
  /** Tipo de contenido del éxito si no es JSON. */
  contentType?: string;
  errors?: ErrorStatus[];
  /** Requisito del SRS que cumple. */
  requirement?: string;
}

/** Registra un endpoint con sus errores y su seguridad. Un solo sitio fija las convenciones de toda la API. */
export function op(o: Operation) {
  const status = o.status ?? 200;
  const errors = new Set<ErrorStatus>(o.errors ?? []);
  if (o.access !== 'public') errors.add(401);
  if (o.access === 'student' || o.access === 'admin') errors.add(403);
  if (o.body || o.query || o.params) errors.add(400);
  const ok = status === 204
    ? { description: o.responseDescription ?? 'Sin contenido.' }
    : { description: o.responseDescription ?? 'OK', content: { [o.contentType ?? 'application/json']: { schema: o.response! } } };
  registry.registerPath({
    method: o.method, path: o.path, tags: [o.tag], operationId: o.operationId, summary: o.summary,
    description: [o.description, ACCESS_TEXT[o.access], o.requirement ? `Requisito: ${o.requirement}.` : ''].filter(Boolean).join('\n\n'),
    security: o.access === 'public' ? [] : [{ [bearerAuth.name]: [] }],
    request: {
      ...(o.params ? { params: o.params as never } : {}),
      ...(o.query ? { query: o.query as never } : {}),
      ...(o.body ? { body: { required: true, content: { 'application/json': { schema: o.body } } } } : {}),
    },
    responses: {
      [status]: ok,
      ...Object.fromEntries([...errors].sort().map((e) => [e, errorRef(e)])),
    } as never,
  });
}
