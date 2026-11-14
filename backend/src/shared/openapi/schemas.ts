import './extend';
import { z } from 'zod';

/** Esquemas de RESPUESTA documentados en OpenAPI (los de entrada viven junto a cada ruta, en el archivo schemas.ts de cada módulo). */

const id = z.string().uuid().openapi({ example: '3f2b8c1e-5a4d-4b7e-9c10-2d6a8e7f1b34' });
const date = z.string().datetime().openapi({ example: '2026-11-14T15:30:00.000Z' });
const role = z.enum(['STUDENT', 'ADMIN']).openapi({ description: 'Rol de acceso (RBAC).' });

export const ErrorResponse = z.object({
  code: z.string().openapi({ example: 'BAD_REQUEST', description: 'Código estable para programas: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, SYNC_IN_PROGRESS, PAYLOAD_TOO_LARGE, INTERNAL.' }),
  message: z.string().openapi({ example: 'Datos inválidos', description: 'Mensaje legible en español.' }),
  issues: z.array(z.string()).optional().openapi({ description: 'Detalle de validación (solo en 400).' }),
  requestId: z.string().openapi({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7', description: 'Igual que la cabecera `X-Request-Id`; cítalo al reportar un problema.' }),
}).openapi('ErrorResponse');

export const PublicUser = z.object({
  id, name: z.string().openapi({ example: 'Dilan Rojas' }), email: z.string().email().openapi({ example: 'dilan@amigo.edu.co' }),
  role, avatarUrl: z.string().nullable(),
}).openapi('PublicUser');

export const LoginResponse = z.object({
  token: z.string().openapi({ description: 'JWT de acceso (60 min). Se envía como `Authorization: Bearer <token>`.' }),
  refreshToken: z.string().openapi({ description: 'Token opaco de un solo uso (7 días) para obtener otro par en `/auth/refresh`.' }),
  user: PublicUser,
}).openapi('LoginResponse');

export const TokenPair = z.object({ token: z.string(), refreshToken: z.string() }).openapi('TokenPair');

export const Profile = z.object({
  id, name: z.string(), email: z.string().email(), role,
  documentType: z.string().nullable().openapi({ example: 'CC' }), documentNumber: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  notifyChannel: z.enum(['IN_APP', 'EMAIL', 'BOTH']), reminderMinutes: z.number().int().openapi({ example: 15 }),
}).openapi('Profile');

export const RegisterResponse = z.object({ email: z.string().email(), verificationRequired: z.literal(true) }).openapi('RegisterResponse');
export const VerifiedResponse = z.object({ verified: z.literal(true) }).openapi('VerifiedResponse');
export const SentResponse = z.object({ sent: z.literal(true) }).openapi('SentResponse');
export const ResetResponse = z.object({ reset: z.literal(true) }).openapi('ResetResponse');

export const ClassSession = z.object({
  externalId: z.string().openapi({ example: '959c4930-ALG101-1' }), userId: id, semester: z.string().openapi({ example: '2026-2' }),
  courseCode: z.string().openapi({ example: 'ALG101' }), courseName: z.string().openapi({ example: 'Algoritmos' }), teacher: z.string().openapi({ example: 'Marta Ríos' }),
  weekday: z.number().int().min(1).max(7), startTime: z.string().openapi({ example: '08:00' }), endTime: z.string().openapi({ example: '10:00' }),
  block: z.string().openapi({ example: 'B' }), floor: z.number().int(), room: z.string().openapi({ example: '305' }),
  status: z.enum(['ACTIVE', 'CANCELLED']),
}).openapi('ClassSession');

export const WeeklySchedule = z.object({
  userId: id, semester: z.string(), enrolled: z.boolean().openapi({ description: 'false si no hay matrícula vigente (RRF-01): `sessions` viene vacío.' }),
  sessions: z.array(ClassSession),
}).openapi('WeeklySchedule');

export const Gap = z.object({
  weekday: z.number().int().min(1).max(7), startTime: z.string().openapi({ example: '10:00' }), endTime: z.string().openapi({ example: '14:00' }),
  minutes: z.number().int().openapi({ example: 240 }), status: z.enum(['OCCUPIED', 'AVAILABLE']),
  activity: z.object({ id, title: z.string() }).nullable(),
  suggestion: z.object({ kind: z.enum(['REST', 'MEAL', 'STUDY']), title: z.string().openapi({ example: 'Estudio' }), detail: z.string() }).nullable()
    .openapi({ description: 'Solo si el hueco está disponible y no tiene actividad propia.' }),
}).openapi('Gap');

export const GapActivity = z.object({
  id, weekday: z.number().int().min(1).max(7), startTime: z.string().openapi({ example: '10:00' }), endTime: z.string().openapi({ example: '14:00' }),
  title: z.string().openapi({ example: 'Biblioteca' }),
}).openapi('GapActivity');

export const Notification = z.object({
  id, userId: id,
  kind: z.enum(['SCHEDULE_ADDED', 'SCHEDULE_UPDATED', 'SCHEDULE_CANCELLED', 'CUSTOM', 'CLASS_REMINDER']),
  title: z.string(), message: z.string(), createdAt: date, readAt: date.nullable(), emailedAt: date.nullable(),
}).openapi('Notification');
export const NotificationList = z.object({ items: z.array(Notification), unread: z.number().int() }).openapi('NotificationList');
export const UpdatedCount = z.object({ updated: z.number().int() }).openapi('UpdatedCount');

export const ScheduledNotification = z.object({
  id, userId: id, kind: z.enum(['CUSTOM', 'CLASS_REMINDER']), title: z.string(), message: z.string(), fireAt: date, firedAt: date.nullable(),
}).openapi('ScheduledNotification');

export const SyncResult = z.object({ runId: id, studentsSynced: z.number().int(), changesCount: z.number().int(), failures: z.number().int() }).openapi('SyncResult');
export const SyncRun = z.object({
  id, trigger: z.enum(['MANUAL', 'CRON']), actorId: z.string().nullable(), startedAt: date, finishedAt: date.nullable(),
  studentsSynced: z.number().int(), changesCount: z.number().int(), status: z.enum(['RUNNING', 'OK', 'PARTIAL', 'FAILED']),
  stats: z.object({ added: z.number().int(), updated: z.number().int(), cancelled: z.number().int() }).nullable(),
}).openapi('SyncRun');

const delivery = z.object({ observer: z.string().openapi({ example: 'email' }), status: z.enum(['OK', 'FAILED']), attempts: z.number().int(), error: z.string().optional() });
export const EventLogEntry = z.object({
  id, type: z.string().openapi({ example: 'ScheduleChanged' }), payload: z.unknown(), occurredAt: date,
  deliveries: z.array(delivery.extend({ deliveredAt: date })),
}).openapi('EventLogEntry');
export const DeliveryReport = z.object({ eventId: id, deliveries: z.array(delivery) }).openapi('DeliveryReport');

export const StudentRef = z.object({ id, name: z.string(), email: z.string().email() }).openapi('StudentRef');
export const UserSummary = z.object({ id, name: z.string(), email: z.string().email(), role, active: z.boolean() }).openapi('UserSummary');
export const AuditEntry = z.object({
  id, actorId: z.string().optional(), actor: z.string().openapi({ example: 'Administrador UNI <admin@horariouni.test>', description: 'Responsable resuelto a nombre y correo, o `sistema`.' }),
  action: z.string().openapi({ example: 'CHANGE_ROLE' }), entity: z.string().openapi({ example: 'user' }), detail: z.unknown().optional(), createdAt: date,
}).openapi('AuditEntry');

export const Program = z.object({ id, code: z.string().openapi({ example: 'ISI' }), name: z.string(), facultyId: id }).openapi('Program');
export const Faculty = z.object({ id, name: z.string(), programs: z.array(Program) }).openapi('Faculty');
export const FacultyRef = z.object({ id, name: z.string() }).openapi('FacultyRef');

export const Health = z.object({ ok: z.literal(true), version: z.string().openapi({ example: 'v1' }) }).openapi('Health');
