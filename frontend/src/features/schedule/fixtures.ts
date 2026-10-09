import type { Session } from './types';

export const mk = (over: Partial<Session> & { externalId: string }): Session => ({
  userId: 'u', semester: '2026-2', courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta Lucía Gómez',
  weekday: 3, startTime: '07:00', endTime: '09:00', block: 'A', floor: 2, room: '201', status: 'ACTIVE', ...over,
});
