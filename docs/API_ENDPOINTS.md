# Endpoints de la API v1 (generado)

Generado desde el contrato OpenAPI (`GET /api/v1/openapi.json`). **42 endpoints** en 8 grupos. Base: `/api/v1`.

### Auth

Registro, verificación por OTP, sesión (JWT + refresh), recuperación de contraseña y perfil.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | Público | 200 | 400, 403, 429 | Iniciar sesión | RF-AUTH-02 |
| POST | `/auth/logout` | Sesión (cualquier rol) | 204 | 400, 401 | Cerrar sesión | RF-AUTH-03 |
| GET | `/auth/me` | Sesión (cualquier rol) | 200 | 401 | Ver mi perfil |  |
| PUT | `/auth/me` | Sesión (cualquier rol) | 200 | 400, 401, 413 | Editar mi perfil | RF-AUTH-06 |
| POST | `/auth/password/forgot` | Público | 200 | 400, 429 | Pedir código para recuperar la contraseña | RF-AUTH-04 |
| POST | `/auth/password/reset` | Público | 200 | 400, 429 | Restablecer la contraseña con OTP | RF-AUTH-04, RNF-07 |
| POST | `/auth/refresh` | Público | 200 | 400, 429 | Renovar la sesión | RNF-05 |
| POST | `/auth/register` | Público | 201 | 400, 409, 429 | Crear cuenta | RF-AUTH-01, RRF-06 |
| POST | `/auth/verify` | Público | 200 | 400, 429 | Verificar cuenta con OTP | RF-AUTH-05 |
| POST | `/auth/verify/resend` | Público | 200 | 400, 429 | Reenviar el código de verificación |  |

### Schedule

Horario semanal con búsqueda y filtros, detalle de clase y exportación PDF/.ics.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/schedule/me` | Sesión (cualquier rol) | 200 | 400, 401 | Mi horario semanal | RF-HOR-01, RF-BUS-01/02 |
| GET | `/schedule/me/export` | Sesión (cualquier rol) | 200 | 400, 401 | Exportar mi horario | RF-HOR-04 |
| GET | `/schedule/sessions/{externalId}` | Sesión (cualquier rol) | 200 | 400, 401, 404 | Detalle de una clase | RF-HOR-03 |
| GET | `/schedule/users/{userId}` | ADMIN | 200 | 400, 401, 403, 404 | Horario de otro usuario (soporte) | RRF-04 |

### Gaps

Tiempos libres entre clases, sugerencias y actividades propias.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/gaps` | STUDENT | 200 | 401, 403 | Mis huecos entre clases | RF-HUE-01, RF-HUE-02 |
| DELETE | `/gaps/activities` | STUDENT | 204 | 400, 401, 403, 404 | Eliminar la actividad de un hueco |  |
| GET | `/gaps/activities` | STUDENT | 200 | 401, 403 | Mis actividades en huecos | RF-HUE-03 |
| POST | `/gaps/activities` | STUDENT | 201 | 400, 401, 403, 404, 409 | Crear una actividad propia en un hueco | RF-HUE-03 |
| PUT | `/gaps/activities` | STUDENT | 200 | 400, 401, 403, 404 | Actualizar la actividad de un hueco | RF-HUE-03 |
| PUT | `/gaps/status` | STUDENT | 204 | 400, 401, 403, 404 | Marcar un hueco como ocupado o disponible | RF-HUE-04 |

### Notifications

Notificaciones en la app, programadas, recordatorios y preferencias de canal.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/notifications` | Sesión (cualquier rol) | 200 | 400, 401 | Mis notificaciones | RF-NOT-03 |
| POST | `/notifications/{id}/read` | Sesión (cualquier rol) | 204 | 400, 401, 404 | Marcar una notificación como leída |  |
| PUT | `/notifications/preferences` | Sesión (cualquier rol) | 200 | 400, 401 | Canal preferido y antelación del recordatorio | RF-NOT-02, RF-NOT-04 |
| POST | `/notifications/read-all` | Sesión (cualquier rol) | 200 | 401 | Marcar todas como leídas |  |
| GET | `/notifications/scheduled` | Sesión (cualquier rol) | 200 | 401 | Mis notificaciones programadas pendientes | RF-NOT-01 |
| POST | `/notifications/scheduled` | Sesión (cualquier rol) | 201 | 400, 401, 404 | Programar una notificación propia | RF-NOT-01 |
| DELETE | `/notifications/scheduled/{id}` | Sesión (cualquier rol) | 204 | 400, 401, 404 | Cancelar una notificación programada |  |

### Realtime

Flujo SSE de eventos en vivo.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/events/stream` | Sesión (cualquier rol) | 200 | 401 | Flujo de eventos en vivo (SSE) | RF-NOT-03 |

### Catalog

Facultades y programas académicos.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/catalog` | Sesión (cualquier rol) | 200 | 401 | Facultades con sus programas | RF-ADM-01 |
| POST | `/catalog/faculties` | ADMIN | 201 | 400, 401, 403, 409 | Crear facultad | RF-ADM-01 |
| POST | `/catalog/programs` | ADMIN | 201 | 400, 401, 403, 409 | Crear programa | RF-ADM-01, RRF-03 |
| DELETE | `/catalog/programs/{id}` | ADMIN | 204 | 400, 401, 403, 404 | Eliminar un programa |  |
| PUT | `/catalog/programs/{id}` | ADMIN | 200 | 400, 401, 403, 404 | Editar o reclasificar un programa | RF-ADM-01 |

### Admin

Sincronización, eventos del Observer, usuarios y roles, auditoría. Solo ADMIN.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/admin/audit` | ADMIN | 200 | 400, 401, 403 | Log de auditoría | RF-ADM-02, RNF-14 |
| GET | `/admin/events` | ADMIN | 200 | 400, 401, 403 | Eventos de dominio y su entrega a cada observador |  |
| POST | `/admin/events/test` | ADMIN | 201 | 400, 401, 403, 404 | Publicar un cambio de horario ficticio (demo del Observer) |  |
| GET | `/admin/students` | ADMIN | 200 | 401, 403 | Estudiantes activos |  |
| POST | `/admin/sync` | ADMIN | 200 | 401, 403, 409 | Sincronizar horarios ahora | RF-ADM-03, RF-HOR-02 |
| GET | `/admin/sync/runs` | ADMIN | 200 | 401, 403 | Últimas corridas de sincronización |  |
| GET | `/admin/users` | ADMIN | 200 | 401, 403 | Todos los usuarios | RF-AUTH-07 |
| PUT | `/admin/users/{id}/role` | ADMIN | 200 | 400, 401, 403, 404 | Cambiar el rol de un usuario | RF-AUTH-07 |

### Health

Disponibilidad.

| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |
|---|---|---|---|---|---|---|
| GET | `/health` | Público | 200 | — | Estado del servicio |  |
