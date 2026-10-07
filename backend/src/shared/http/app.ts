import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Config } from '../config';
import { Container } from '../container';
import { authRoutes } from '../../modules/auth/http/authRoutes';
import { adminRoutes } from '../../modules/schedule/http/adminRoutes';
import { scheduleRoutes } from '../../modules/schedule/http/scheduleRoutes';
import { notFound } from '../errors';
import { errorHandler } from './errorHandler';

export function createApp(c: Container, cfg: Config) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: cfg.corsOrigin, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(c));
  app.use('/api/schedule', scheduleRoutes(c));
  app.use('/api/admin', adminRoutes(c));
  app.use((_req, _res, next) => next(notFound('Ruta no encontrada')));
  app.use(errorHandler);
  return app;
}
