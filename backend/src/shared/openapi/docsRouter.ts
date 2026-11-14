import { NextFunction, Request, Response, Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './spec';

/**
 * `GET /api/v1/openapi.json` (contrato máquina-legible) y `GET /api/v1/docs` (Swagger UI).
 * Swagger UI necesita scripts y estilos propios, por lo que estas rutas llevan su propia política de seguridad;
 * el resto de la API conserva la política estricta de helmet.
 */
export function docsRouter(): Router {
  const r = Router();
  const relaxed = helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'] } },
  });
  r.get('/openapi.json', relaxed, (_req, res) => res.json(buildOpenApiDocument()));
  r.use('/docs', relaxed, swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => swaggerUi.setup(buildOpenApiDocument(), {
    customSiteTitle: 'Horario UNI — API v1',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  })(req, res, next));
  return r;
}
