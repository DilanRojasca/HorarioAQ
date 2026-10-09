import { NotificationKind } from '../../../shared/events/types';

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  emailedAt: Date | null;
}

export interface NotificationRepository {
  create(n: { userId: string; kind: NotificationKind; title: string; message: string }): Promise<NotificationRecord>;
  listByUser(userId: string, opts: { unreadOnly?: boolean; limit: number }): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  /** `false` si no existe o no pertenece al usuario. */
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  findById(id: string): Promise<NotificationRecord | null>;
  markEmailed(id: string, at: Date): Promise<void>;
  listPendingEmail(since: Date, limit: number): Promise<NotificationRecord[]>;
}
