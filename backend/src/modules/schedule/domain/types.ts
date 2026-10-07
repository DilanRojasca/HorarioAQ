export type Role = 'STUDENT' | 'ADMIN';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SessionStatus = 'ACTIVE' | 'CANCELLED';

export interface ClassSession {
  externalId: string;
  userId: string;
  semester: string;
  courseCode: string;
  courseName: string;
  teacher: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  block: string;
  floor: number;
  room: string;
  status: SessionStatus;
}

export type ChangeType = 'ADDED' | 'UPDATED' | 'CANCELLED';

export interface ScheduleChange {
  type: ChangeType;
  externalId: string;
  userId: string;
  before?: ClassSession;
  after?: ClassSession;
}
