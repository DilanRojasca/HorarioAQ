import { randomUUID } from 'node:crypto';
import { RequestHandler } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { requestId?: string } }
}

const VALID_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Buena práctica de API: correlación y privacidad por petición.
 *  - `X-Request-Id`: se respeta el que mande el cliente (si es seguro) o se genera uno. Viaja en la respuesta y en el cuerpo de
 *    todo error (`requestId`), así un reporte de soporte se cruza con el log del servidor.
 *  - `Cache-Control: no-store`: las respuestas de la API son datos personales (horario, perfil, notificaciones); no deben quedar en cachés.
 *
 * @pattern Chain of Responsibility | Eslabón de la cadena de middlewares | Primer eslabón: asigna el contexto que usan los siguientes.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  res.setHeader('Cache-Control', 'no-store');
  next();
};
