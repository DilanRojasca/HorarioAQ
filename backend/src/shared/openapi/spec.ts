import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { API_BASE, API_VERSION } from '../http/v1';
import { registerAllPaths } from './paths';
import { registry } from './registry';

let cached: ReturnType<OpenApiGeneratorV3['generateDocument']> | undefined;

/** Documento OpenAPI 3.0.3 de la API v1 (se genera una vez a partir de los esquemas zod). */
export function buildOpenApiDocument() {
  if (cached) return cached;
  registerAllPaths();
  cached = new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Horario UNI — API',
      version: '1.0.0',
      description: [
        'API REST de **Horario UNI** (Universidad Católica Luis Amigó): horario académico, huecos, notificaciones y administración.',
        '',
        '### Cómo probarla',
        '1. `POST /auth/login` con un usuario de prueba.',
        '2. Pulsa **Authorize** (arriba a la derecha) y pega el `token` (sin la palabra `Bearer`).',
        '3. Ejecuta cualquier endpoint con **Try it out**.',
        '',
        '### Convenciones',
        `- **Versionado por URL:** \`${API_BASE}\`. Los cambios incompatibles irán a \`/api/v2\`; las rutas sin versión (\`/api/...\`) están **obsoletas** y responden con la cabecera \`Deprecation\`.`,
        '- **Errores:** siempre `{ code, message, issues?, requestId }`. El `requestId` coincide con la cabecera `X-Request-Id`.',
        '- **Autenticación:** JWT en `Authorization: Bearer`. Access token 60 min; renovable con refresh token rotativo (7 días).',
        '- **Autorización:** RBAC con roles `STUDENT` y `ADMIN`; cada operación indica quién puede usarla.',
        '- **Códigos:** `201` creación · `204` sin contenido · `400` validación · `401` sin sesión · `403` sin permiso · `404` no existe · `409` conflicto · `429` límite de solicitudes.',
        '- **Caché:** las respuestas llevan `Cache-Control: no-store` (son datos personales).',
      ].join('\n'),
      contact: { name: 'Equipo Horario UNI', email: 'dilanrojasc6@gmail.com' },
      license: { name: 'Uso académico' },
    },
    servers: [{ url: API_BASE, description: `API ${API_VERSION}` }],
    tags: [
      { name: 'Auth', description: 'Registro, verificación por OTP, sesión (JWT + refresh), recuperación de contraseña y perfil.' },
      { name: 'Schedule', description: 'Horario semanal con búsqueda y filtros, detalle de clase y exportación PDF/.ics.' },
      { name: 'Gaps', description: 'Tiempos libres entre clases, sugerencias y actividades propias.' },
      { name: 'Notifications', description: 'Notificaciones en la app, programadas, recordatorios y preferencias de canal.' },
      { name: 'Realtime', description: 'Flujo SSE de eventos en vivo.' },
      { name: 'Catalog', description: 'Facultades y programas académicos.' },
      { name: 'Admin', description: 'Sincronización, eventos del Observer, usuarios y roles, auditoría. Solo ADMIN.' },
      { name: 'Health', description: 'Disponibilidad.' },
    ],
  });
  return cached;
}
