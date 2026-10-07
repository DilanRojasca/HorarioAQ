import { UseCase } from '../../../shared/ports';
import { assertCanView } from '../domain/access';
import { activeSessions, sortSessions } from '../domain/sort';
import { ClassSession, Role } from '../domain/types';
import { EnrollmentRepository, ScheduleRepository } from './ports';

export interface WeeklyInput { requesterId: string; requesterRole: Role; targetUserId?: string }
export interface WeeklyResult { userId: string; semester: string; enrolled: boolean; sessions: ClassSession[] }

export class GetWeeklyScheduleUseCase implements UseCase<WeeklyInput, WeeklyResult> {
  constructor(
    private schedules: ScheduleRepository,
    private enrollments: EnrollmentRepository,
    private semester: string,
  ) {}

  async execute(i: WeeklyInput): Promise<WeeklyResult> {
    const userId = i.targetUserId ?? i.requesterId;
    assertCanView({ id: i.requesterId, role: i.requesterRole }, userId);
    const enrolled = await this.enrollments.hasActive(userId, this.semester);
    if (!enrolled) return { userId, semester: this.semester, enrolled, sessions: [] };
    const all = await this.schedules.findByUser(userId, this.semester);
    return { userId, semester: this.semester, enrolled, sessions: sortSessions(activeSessions(all)) };
  }
}
