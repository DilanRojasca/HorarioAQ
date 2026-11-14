import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Config } from '../config';
import { Container } from '../container';
import { docsRouter } from '../openapi/docsRouter';
import { notFound } from '../errors';
import { errorHandler } from './errorHandler';
import { requestContext } from './requestContext';
import { API_BASE, buildV1Router } from './v1';

/**
 * Compatibilidad: las rutas anteriores a la versión (`/api/auth/...`) siguen respondiendo pero marcadas como
 * obsoletas (RFC 9745: `Deprecation`) y con un enlace a su sucesor. Los clientes nuevos deben usar `/api/v1`.
 */
const deprecatedAlias: express.RequestHandler = (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', `<${API_BASE}${req.url.split('?')[0]}>; rel="successor-version"`);
  next();
};

/** @pattern Chain of Responsibility | Armado de la cadena de middlewares | requestContext → helmet → cors → json → rutas → notFound → errorHandler. */
export function createApp(c: Container, cfg: Config) {
  const app = express();
  // Detrás de nginx/balanceador: nº de proxies de confianza (0 = sin proxy, desarrollo local).
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0) || 0);
  app.use(requestContext);
  app.use(API_BASE, docsRouter()); // Swagger UI + openapi.json: con su propia política CSP, antes de helmet global
  app.use(helmet());
  app.use(cors({ origin: cfg.corsOrigin, exposedHeaders: ['Content-Disposition', 'X-Request-Id', 'Deprecation', 'Link'] }));
  // Límite global de 100 kb; solo el perfil admite más (la foto viaja como data-URL pequeña) y lo declara su ruta.
  const defaultJson = express.json();
  app.use((req, res, next) => (req.method === 'PUT' && req.path.endsWith('/auth/me') ? next() : defaultJson(req, res, next)));
  app.get('/api/health', (_req, res) => res.json({ ok: true })); // sonda de infraestructura, sin versión
  const v1 = buildV1Router(c);
  app.use(API_BASE, v1);
  app.use('/api', deprecatedAlias, v1);
  app.use((_req, _res, next) => next(notFound('Ruta no encontrada')));
  app.use(errorHandler);
  return app;
}
