import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Config } from '../config';
import { Container } from '../container';
import { authRoutes } from '../../modules/auth/http/authRoutes';
import { catalogRoutes } from '../../modules/catalog/http/catalogRoutes';
import { gapRoutes } from '../../modules/gaps/http/gapRoutes';
import { notificationRoutes } from '../../modules/notifications/http/notificationRoutes';
import { eventsRoutes } from '../../modules/realtime/http/eventsRoutes';
import { adminRoutes } from '../../modules/schedule/http/adminRoutes';
import { scheduleRoutes } from '../../modules/schedule/http/scheduleRoutes';
import { notFound } from '../errors';
import { errorHandler } from './errorHandler';

export function createApp(c: Container, cfg: Config) {
  const app = express();
  // Detrás de nginx/balanceador: nº de proxies de confianza (0 = sin proxy, desarrollo local).
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0) || 0);
  app.use(helmet());
  app.use(cors({ origin: cfg.corsOrigin, exposedHeaders: ['Content-Disposition'] }));
  // Límite global de 100 kb; solo el perfil admite más (la foto viaja como data-URL pequeña) y lo declara su ruta.
  const defaultJson = express.json();
  app.use((req, res, next) => (req.method === 'PUT' && req.path === '/api/auth/me' ? next() : defaultJson(req, res, next)));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(c));
  app.use('/api/schedule', scheduleRoutes(c));
  app.use('/api/gaps', gapRoutes(c));
  app.use('/api/catalog', catalogRoutes(c));
  app.use('/api/notifications', notificationRoutes(c));
  app.use('/api/events', eventsRoutes(c));
  app.use('/api/admin', adminRoutes(c));
  app.use((_req, _res, next) => next(notFound('Ruta no encontrada')));
  app.use(errorHandler);
  return app;
}
