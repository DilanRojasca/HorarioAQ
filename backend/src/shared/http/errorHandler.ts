import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

/**
 * Formato de error ÚNICO de la API: `{ code, message, issues?, requestId }`. Está documentado en OpenAPI como `ErrorResponse`.
 *
 * @pattern Chain of Responsibility | Último eslabón (manejo de errores) | Traduce cualquier error de la cadena a una respuesta coherente.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const json = res.json.bind(res);
  res.json = (body: object) => json({ ...body, requestId: res.locals.requestId });
  if (err instanceof ZodError) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'Datos inválidos', issues: err.issues.map((i) => i.message) });
  }
  if (err instanceof AppError) return res.status(err.status).json({ code: err.code, message: err.message });
  // Errores de body-parser (JSON malformado, cuerpo demasiado grande, etc.).
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ code: 'BAD_REQUEST', message: 'Cuerpo de la solicitud inválido' });
  if (e?.type === 'entity.too.large') return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'Cuerpo de la solicitud demasiado grande' });
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    return res.status(e.status).json({ code: 'BAD_REQUEST', message: 'Solicitud inválida' });
  }
  console.error(err);
  res.status(500).json({ code: 'INTERNAL', message: 'Error interno del servidor' });
};
