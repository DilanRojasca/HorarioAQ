import { NotificationKind } from '../../../shared/events/types';

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  /** Marca de reclamo/envío: se fija ANTES de enviar (ver `claimEmail`) y se libera si el envío falla. */
  emailedAt: Date | null;
  /** Terminal: el correo no aplica (usuario inexistente o inactivo); nunca se vuelve a intentar. */
  emailSkippedAt: Date | null;
  /** Envíos fallidos acumulados; al llegar a `MAX_EMAIL_ATTEMPTS` deja de ser candidata al reintento. */
  emailAttempts: number;
}

/** Reintentos del bus para el observador `email` (por entrega: 1 intento + 3 reintentos). */
export const EMAIL_OBSERVER_RETRIES = 3;
export const ATTEMPTS_PER_DELIVERY = EMAIL_OBSERVER_RETRIES + 1;
/** Rondas de entrega (en vivo o del job de pendientes) tras las cuales se deja de reintentar una notificación. */
export const MAX_EMAIL_DELIVERY_ROUNDS = 5;
/** Tope de envíos fallidos acumulados (`emailAttempts` suma cada intento del bus): 5 rondas de 4 intentos. */
export const MAX_EMAIL_ATTEMPTS = MAX_EMAIL_DELIVERY_ROUNDS * ATTEMPTS_PER_DELIVERY;

export interface NotificationRepository {
  create(n: { userId: string; kind: NotificationKind; title: string; message: string }): Promise<NotificationRecord>;
  listByUser(userId: string, opts: { unreadOnly?: boolean; limit: number }): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  /** `false` si no existe o no pertenece al usuario. */
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  findById(id: string): Promise<NotificationRecord | null>;
  /**
   * Reclamo atómico del envío: fija `emailedAt = at` solo si sigue en null (y no está omitida).
   * Devuelve `true` únicamente a quien ganó el reclamo; así dos entregas concurrentes no envían dos veces.
   */
  claimEmail(id: string, at: Date): Promise<boolean>;
  /** Libera el reclamo (`emailedAt = null`) tras un envío fallido, para que pueda reintentarse. */
  releaseEmail(id: string): Promise<void>;
  /** Suma un envío fallido a `emailAttempts`. */
  recordEmailFailure(id: string): Promise<void>;
  /** Marca la notificación como sin correo aplicable (terminal). */
  markEmailSkipped(id: string, at: Date): Promise<void>;
  /** Pendientes de correo desde `since`, más antiguas primero; excluye omitidas y las que alcanzaron el tope de intentos. */
  listPendingEmail(since: Date, limit: number): Promise<NotificationRecord[]>;
}

export interface EmailMessage { to: string; subject: string; text: string; html?: string }

/** Puerto de salida de correo; los adaptadores (consola, Brevo) lo implementan. */
export interface EmailPort {
  send(msg: EmailMessage): Promise<void>;
}
