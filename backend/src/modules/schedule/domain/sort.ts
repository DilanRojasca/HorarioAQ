import { ClassSession } from './types';

export const activeSessions = (s: ClassSession[]) => s.filter((x) => x.status === 'ACTIVE');

export const sortSessions = (s: ClassSession[]) =>
  [...s].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
