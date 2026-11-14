import './extend';
import { z } from 'zod';
import { emailOnlyBody, loginBody, logoutBody, profileBody, refreshBody, registerBody, resetBody, verifyBody } from '../../modules/auth/http/schemas';
import { facultyBody, programBody, programUpdateBody, uuid as catalogUuid } from '../../modules/catalog/http/schemas';
import { activityBody, gapKey, statusBody } from '../../modules/gaps/http/schemas';
import { listQuery, prefsBody, scheduleBody, uuid as notifUuid } from '../../modules/notifications/http/schemas';
import { auditQuery, eventsQuery, exportQuery, roleBody, scheduleQuery, sessionDetailQuery, testEventBody, uuid } from '../../modules/schedule/http/schemas';
import { op } from './registry';
import * as S from './schemas';

const idParam = (u = uuid) => z.object({ id: u.openapi({ param: { name: 'id', in: 'path' } }) });

/**
 * Catálogo de TODOS los endpoints de la API v1, agrupados por etiqueta. Cada `op(...)` reutiliza el esquema zod que la
 * ruta ya usa para validar, así que lo documentado es exactamente lo que el servidor acepta. Un test
 * (`tests/openapi/openapi.test.ts`) falla si una ruta de Express no está aquí o si aquí hay una ruta que no existe.
 */
export function registerAllPaths() {
  /* ----------------------------------------------------------------- Health */
  op({ method: 'get', path: '/health', tag: 'Health', operationId: 'getHealth', summary: 'Estado del servicio', access: 'public', response: S.Health, description: 'Sonda de disponibilidad de la versión 1.' });

  /* ------------------------------------------------------------------- Auth */
  op({ method: 'post', path: '/auth/register', tag: 'Auth', operationId: 'register', summary: 'Crear cuenta', status: 201, access: 'public', requirement: 'RF-AUTH-01, RRF-06',
    description: 'Crea una cuenta **inactiva** y envía un código OTP al correo institucional. La cuenta se activa con `POST /auth/verify`.',
    body: registerBody, response: S.RegisterResponse, responseDescription: 'Cuenta creada; falta verificar.', errors: [409, 429] });
  op({ method: 'post', path: '/auth/verify', tag: 'Auth', operationId: 'verifyAccount', summary: 'Verificar cuenta con OTP', access: 'public', requirement: 'RF-AUTH-05',
    description: 'El código vence a los 10 minutos, es de un solo uso y se bloquea tras 5 intentos fallidos.',
    body: verifyBody, response: S.VerifiedResponse, errors: [429] });
  op({ method: 'post', path: '/auth/verify/resend', tag: 'Auth', operationId: 'resendVerification', summary: 'Reenviar el código de verificación', access: 'public',
    description: 'Responde igual exista o no la cuenta (no revela qué correos están registrados).', body: emailOnlyBody, response: S.SentResponse, errors: [429] });
  op({ method: 'post', path: '/auth/login', tag: 'Auth', operationId: 'login', summary: 'Iniciar sesión', access: 'public', requirement: 'RF-AUTH-02',
    description: 'Devuelve un token de acceso (60 min) y un refresh token rotativo (7 días). Una cuenta sin verificar responde `403`.',
    body: loginBody, response: S.LoginResponse, errors: [403, 429] });
  op({ method: 'post', path: '/auth/refresh', tag: 'Auth', operationId: 'refreshSession', summary: 'Renovar la sesión', access: 'public', requirement: 'RNF-05',
    description: 'Consume el refresh token (uso único) y emite un par nuevo. Reutilizar uno ya consumido responde `401`.',
    body: refreshBody, response: S.TokenPair, errors: [429] });
  op({ method: 'post', path: '/auth/logout', tag: 'Auth', operationId: 'logout', summary: 'Cerrar sesión', status: 204, access: 'any', requirement: 'RF-AUTH-03',
    description: 'Invalida el token de acceso actual y, si se envía, el refresh token.', body: logoutBody.optional() });
  op({ method: 'post', path: '/auth/password/forgot', tag: 'Auth', operationId: 'requestPasswordReset', summary: 'Pedir código para recuperar la contraseña', access: 'public', requirement: 'RF-AUTH-04',
    description: 'Envía un OTP al correo si la cuenta existe y está activa; la respuesta es idéntica en ambos casos.', body: emailOnlyBody, response: S.SentResponse, errors: [429] });
  op({ method: 'post', path: '/auth/password/reset', tag: 'Auth', operationId: 'resetPassword', summary: 'Restablecer la contraseña con OTP', access: 'public', requirement: 'RF-AUTH-04, RNF-07',
    description: 'Cambia la contraseña y **cierra todas las sesiones** del usuario.', body: resetBody, response: S.ResetResponse, errors: [429] });
  op({ method: 'get', path: '/auth/me', tag: 'Auth', operationId: 'getProfile', summary: 'Ver mi perfil', access: 'any', response: S.Profile });
  op({ method: 'put', path: '/auth/me', tag: 'Auth', operationId: 'updateProfile', summary: 'Editar mi perfil', access: 'any', requirement: 'RF-AUTH-06',
    description: 'Permite cambiar nombre, foto y contraseña. El correo y el documento **no** se pueden modificar (el esquema es estricto: cualquier otro campo da `400`). Cambiar la contraseña exige la actual. Admite cuerpos de hasta 256 kb (foto).',
    body: profileBody, response: S.Profile, errors: [413] });

  /* --------------------------------------------------------------- Schedule */
  op({ method: 'get', path: '/schedule/me', tag: 'Schedule', operationId: 'getMySchedule', summary: 'Mi horario semanal', access: 'any', requirement: 'RF-HOR-01, RF-BUS-01/02',
    description: 'Con filtros opcionales combinables (se aplican con el patrón Specification en el dominio).', query: scheduleQuery, response: S.WeeklySchedule });
  op({ method: 'get', path: '/schedule/me/export', tag: 'Schedule', operationId: 'exportMySchedule', summary: 'Exportar mi horario', access: 'any', requirement: 'RF-HOR-04',
    description: 'Descarga el horario en PDF o `.ics` (Google Calendar / Outlook). La cabecera `Content-Disposition` trae el nombre del archivo.',
    query: exportQuery, response: z.string().openapi({ type: 'string', format: 'binary' }), contentType: 'application/octet-stream', responseDescription: 'Archivo (`application/pdf` o `text/calendar`).' });
  op({ method: 'get', path: '/schedule/users/{userId}', tag: 'Schedule', operationId: 'getUserSchedule', summary: 'Horario de otro usuario (soporte)', access: 'admin', requirement: 'RRF-04',
    description: 'Solo administradores, con fines de soporte. **Queda registrado en la auditoría** (`VIEW_THIRD_PARTY_SCHEDULE`).',
    params: z.object({ userId: uuid.openapi({ param: { name: 'userId', in: 'path' } }) }), response: S.WeeklySchedule, errors: [404] });
  op({ method: 'get', path: '/schedule/sessions/{externalId}', tag: 'Schedule', operationId: 'getSessionDetail', summary: 'Detalle de una clase', access: 'any', requirement: 'RF-HOR-03',
    params: z.object({ externalId: z.string().openapi({ param: { name: 'externalId', in: 'path' }, example: '959c4930-ALG101-1' }) }), query: sessionDetailQuery,
    response: S.ClassSession, errors: [404] });

  /* ------------------------------------------------------------------- Gaps */
  op({ method: 'get', path: '/gaps', tag: 'Gaps', operationId: 'listGaps', summary: 'Mis huecos entre clases', access: 'student', requirement: 'RF-HUE-01, RF-HUE-02',
    description: 'Espacios de al menos 15 min entre clases consecutivas del mismo día, con la sugerencia calculada por el patrón Strategy (<30 descanso · 30–60 alimentación · >60 estudio).',
    response: z.array(S.Gap) });
  op({ method: 'get', path: '/gaps/activities', tag: 'Gaps', operationId: 'listGapActivities', summary: 'Mis actividades en huecos', access: 'student', requirement: 'RF-HUE-03',
    response: z.array(S.GapActivity) });
  op({ method: 'post', path: '/gaps/activities', tag: 'Gaps', operationId: 'createGapActivity', summary: 'Crear una actividad propia en un hueco', status: 201, access: 'student', requirement: 'RF-HUE-03',
    description: 'Regla de negocio: el hueco debe existir en tu horario actual (`404` si no), no estar marcado como ocupado y no tener ya una actividad (`409` en ambos casos). Para modificar una existente usa `PUT`.',
    body: activityBody, response: S.GapActivity, errors: [404, 409] });
  op({ method: 'put', path: '/gaps/activities', tag: 'Gaps', operationId: 'updateGapActivity', summary: 'Actualizar la actividad de un hueco', access: 'student', requirement: 'RF-HUE-03',
    body: activityBody, response: S.GapActivity, errors: [404] });
  op({ method: 'delete', path: '/gaps/activities', tag: 'Gaps', operationId: 'removeGapActivity', summary: 'Eliminar la actividad de un hueco', status: 204, access: 'student', body: gapKey, errors: [404] });
  op({ method: 'put', path: '/gaps/status', tag: 'Gaps', operationId: 'setGapStatus', summary: 'Marcar un hueco como ocupado o disponible', status: 204, access: 'student', requirement: 'RF-HUE-04',
    description: 'Un hueco ocupado deja de recibir sugerencias.', body: statusBody, errors: [404] });

  /* ---------------------------------------------------------- Notifications */
  op({ method: 'get', path: '/notifications', tag: 'Notifications', operationId: 'listNotifications', summary: 'Mis notificaciones', access: 'any', requirement: 'RF-NOT-03',
    query: listQuery, response: S.NotificationList });
  op({ method: 'post', path: '/notifications/read-all', tag: 'Notifications', operationId: 'markAllNotificationsRead', summary: 'Marcar todas como leídas', access: 'any', response: S.UpdatedCount });
  op({ method: 'post', path: '/notifications/{id}/read', tag: 'Notifications', operationId: 'markNotificationRead', summary: 'Marcar una notificación como leída', status: 204, access: 'any',
    params: idParam(notifUuid), errors: [404] });
  op({ method: 'get', path: '/notifications/scheduled', tag: 'Notifications', operationId: 'listScheduledNotifications', summary: 'Mis notificaciones programadas pendientes', access: 'any', requirement: 'RF-NOT-01',
    response: z.array(S.ScheduledNotification) });
  op({ method: 'post', path: '/notifications/scheduled', tag: 'Notifications', operationId: 'createScheduledNotification', summary: 'Programar una notificación propia', status: 201, access: 'any', requirement: 'RF-NOT-01',
    description: 'Se entregará a la hora indicada por tu canal preferido, respetando la ventana de 6:00 a. m. a 10:00 p. m. Devuelve la lista actualizada de pendientes.',
    body: scheduleBody, response: z.array(S.ScheduledNotification), errors: [404] });
  op({ method: 'delete', path: '/notifications/scheduled/{id}', tag: 'Notifications', operationId: 'cancelScheduledNotification', summary: 'Cancelar una notificación programada', status: 204, access: 'any',
    params: idParam(notifUuid), errors: [404] });
  op({ method: 'put', path: '/notifications/preferences', tag: 'Notifications', operationId: 'updateNotificationPreferences', summary: 'Canal preferido y antelación del recordatorio', access: 'any', requirement: 'RF-NOT-02, RF-NOT-04',
    body: prefsBody, response: S.Profile });

  /* --------------------------------------------------------------- Realtime */
  op({ method: 'get', path: '/events/stream', tag: 'Realtime', operationId: 'streamEvents', summary: 'Flujo de eventos en vivo (SSE)', access: 'any', requirement: 'RF-NOT-03',
    description: 'Conexión `text/event-stream` que se mantiene abierta. Eventos con nombre: `ready`, `notification`, `schedule-changed`. El token va en la cabecera `Authorization` (no en la URL). Es el lado servidor del patrón Observer hacia el navegador.',
    response: z.string().openapi({ type: 'string', example: 'event: notification\ndata: {"id":"…","title":"Cambio en Física"}\n\n' }), contentType: 'text/event-stream', responseDescription: 'Flujo SSE.' });

  /* ---------------------------------------------------------------- Catalog */
  op({ method: 'get', path: '/catalog', tag: 'Catalog', operationId: 'listCatalog', summary: 'Facultades con sus programas', access: 'any', requirement: 'RF-ADM-01', response: z.array(S.Faculty) });
  op({ method: 'post', path: '/catalog/faculties', tag: 'Catalog', operationId: 'createFaculty', summary: 'Crear facultad', status: 201, access: 'admin', requirement: 'RF-ADM-01',
    description: 'Queda auditado (`CATALOG_CREATE_FACULTY`).', body: facultyBody, response: S.FacultyRef, errors: [409] });
  op({ method: 'post', path: '/catalog/programs', tag: 'Catalog', operationId: 'createProgram', summary: 'Crear programa', status: 201, access: 'admin', requirement: 'RF-ADM-01, RRF-03',
    description: 'Todo programa debe pertenecer a una facultad existente. El código es único. Queda auditado.', body: programBody, response: S.Program, errors: [409] });
  op({ method: 'put', path: '/catalog/programs/{id}', tag: 'Catalog', operationId: 'updateProgram', summary: 'Editar o reclasificar un programa', access: 'admin', requirement: 'RF-ADM-01',
    params: idParam(catalogUuid), body: programUpdateBody, response: S.Program, errors: [404] });
  op({ method: 'delete', path: '/catalog/programs/{id}', tag: 'Catalog', operationId: 'deleteProgram', summary: 'Eliminar un programa', status: 204, access: 'admin',
    params: idParam(catalogUuid), errors: [404] });

  /* ------------------------------------------------------------------ Admin */
  op({ method: 'post', path: '/admin/sync', tag: 'Admin', operationId: 'runSync', summary: 'Sincronizar horarios ahora', access: 'admin', requirement: 'RF-ADM-03, RF-HOR-02',
    description: 'Ejecuta la sincronización masiva con el sistema institucional. Solo puede haber una corrida a la vez (`409 SYNC_IN_PROGRESS`).',
    response: S.SyncResult, errors: [409] });
  op({ method: 'get', path: '/admin/sync/runs', tag: 'Admin', operationId: 'listSyncRuns', summary: 'Últimas corridas de sincronización', access: 'admin', response: z.array(S.SyncRun) });
  op({ method: 'get', path: '/admin/events', tag: 'Admin', operationId: 'listDomainEvents', summary: 'Eventos de dominio y su entrega a cada observador', access: 'admin',
    description: 'Historial del bus de eventos (patrón Observer): por cada evento, el resultado de cada observador (OK/FALLIDO, intentos).', query: eventsQuery, response: z.array(S.EventLogEntry) });
  op({ method: 'post', path: '/admin/events/test', tag: 'Admin', operationId: 'publishTestEvent', summary: 'Publicar un cambio de horario ficticio (demo del Observer)', status: 201, access: 'admin',
    description: 'No modifica ningún horario real. Dispara la cadena completa de observadores hacia un estudiante.', body: testEventBody, response: S.DeliveryReport, errors: [404] });
  op({ method: 'get', path: '/admin/students', tag: 'Admin', operationId: 'listStudents', summary: 'Estudiantes activos', access: 'admin', response: z.array(S.StudentRef) });
  op({ method: 'get', path: '/admin/users', tag: 'Admin', operationId: 'listUsers', summary: 'Todos los usuarios', access: 'admin', requirement: 'RF-AUTH-07', response: z.array(S.UserSummary) });
  op({ method: 'put', path: '/admin/users/{id}/role', tag: 'Admin', operationId: 'changeUserRole', summary: 'Cambiar el rol de un usuario', access: 'admin', requirement: 'RF-AUTH-07',
    description: 'Un administrador no puede cambiar su propio rol. Queda auditado (`CHANGE_ROLE`).', params: idParam(), body: roleBody, response: S.UserSummary, errors: [404] });
  op({ method: 'get', path: '/admin/audit', tag: 'Admin', operationId: 'listAudit', summary: 'Log de auditoría', access: 'admin', requirement: 'RF-ADM-02, RNF-14',
    description: 'Inicios de sesión (incluidos los fallidos), registros, sincronizaciones y cambios sensibles, con su responsable.', query: auditQuery, response: z.array(S.AuditEntry) });
}
