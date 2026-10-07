import { notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { assertCanView } from '../domain/access';
import { ClassSession, Role } from '../domain/types';
import { ScheduleRepository } from './ports';

export interface DetailInput { requesterId: string; requesterRole: Role; externalId: string; ownerId?: string }

export class GetSessionDetailUseCase implements UseCase<DetailInput, ClassSession> {
  constructor(private schedules: ScheduleRepository) {}

  async execute(i: DetailInput): Promise<ClassSession> {
    const owner = i.ownerId ?? i.requesterId;
    assertCanView({ id: i.requesterId, role: i.requesterRole }, owner);
    const s = await this.schedules.findOne(owner, i.externalId);
    if (!s) throw notFound('Clase no encontrada');
    return s;
  }
}
