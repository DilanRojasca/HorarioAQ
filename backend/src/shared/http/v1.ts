import { Router } from 'express';
import { Container } from '../container';
import { authRoutes } from '../../modules/auth/http/authRoutes';
import { catalogRoutes } from '../../modules/catalog/http/catalogRoutes';
import { gapRoutes } from '../../modules/gaps/http/gapRoutes';
import { notificationRoutes } from '../../modules/notifications/http/notificationRoutes';
import { eventsRoutes } from '../../modules/realtime/http/eventsRoutes';
import { adminRoutes } from '../../modules/schedule/http/adminRoutes';
import { scheduleRoutes } from '../../modules/schedule/http/scheduleRoutes';

export const API_VERSION = 'v1';
export const API_BASE = `/api/${API_VERSION}`;

/**
 * Versión 1 de la API. TODAS las rutas de negocio cuelgan de aquí, así que `/api/v1/...` es el contrato público.
 * Un cambio incompatible (quitar un campo, cambiar un tipo) se publica como `/api/v2` sin tocar `/api/v1`;
 * los cambios compatibles (campos nuevos opcionales, endpoints nuevos) se agregan a v1.
 *
 * @pattern Facade | Punto único de montaje de la API v1 | Une los routers de cada módulo bajo un solo prefijo versionado.
 */
export function buildV1Router(c: Container): Router {
  const v1 = Router();
  v1.get('/health', (_req, res) => res.json({ ok: true, version: API_VERSION }));
  v1.use('/auth', authRoutes(c));
  v1.use('/schedule', scheduleRoutes(c));
  v1.use('/gaps', gapRoutes(c));
  v1.use('/catalog', catalogRoutes(c));
  v1.use('/notifications', notificationRoutes(c));
  v1.use('/events', eventsRoutes(c));
  v1.use('/admin', adminRoutes(c));
  return v1;
}
