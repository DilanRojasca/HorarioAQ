export interface Session {
  externalId: string; userId: string; semester: string; courseCode: string; courseName: string; teacher: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; startTime: string; endTime: string;
  block: string; floor: number; room: string; status: 'ACTIVE' | 'CANCELLED';
}
export interface WeeklyResult { userId: string; semester: string; enrolled: boolean; sessions: Session[] }
