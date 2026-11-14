import { api } from '../../shared/api';

export interface AppNotification {
  id: string;
  userId?: string;
  kind: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  emailedAt?: string | null;
}
export interface NotificationList { items: AppNotification[]; unread: number }

export function listNotifications(opts: { unread?: boolean; limit?: number } = {}): Promise<NotificationList> {
  const q = new URLSearchParams();
  if (opts.unread) q.set('unread', '1');
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return api.get<NotificationList>(`/notifications${qs ? `?${qs}` : ''}`);
}

export const markRead = (id: string) => api.post<void>(`/notifications/${id}/read`);
export const markAllRead = () => api.post<{ updated: number }>('/notifications/read-all');

export interface ScheduledNotification { id: string; kind: 'CUSTOM' | 'CLASS_REMINDER'; title: string; message: string; fireAt: string }
export type NotifyChannel = 'IN_APP' | 'EMAIL' | 'BOTH';
export interface Preferences { notifyChannel: NotifyChannel; reminderMinutes: number }

export const listScheduled = () => api.get<ScheduledNotification[]>('/notifications/scheduled');
export const createScheduled = (b: { title: string; message: string; fireAt: string; sessionExternalId?: string }) =>
  api.post<ScheduledNotification[]>('/notifications/scheduled', b);
export const cancelScheduled = (id: string) => api.del(`/notifications/scheduled/${id}`);
export const getPreferences = () => api.get<Preferences>('/auth/me');
export const savePreferences = (p: Partial<Preferences>) => api.put<Preferences>('/notifications/preferences', p);
