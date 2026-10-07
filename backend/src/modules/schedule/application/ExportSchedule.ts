import { notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { UserRepository } from '../../auth/application/ports';
import { BaseExporter, ExportResult } from '../infrastructure/exporters/BaseExporter';
import { Role } from '../domain/types';
import { GetWeeklyScheduleUseCase } from './GetWeeklySchedule';

export type ExportFormat = 'ics' | 'pdf';
export interface ExportInput { requesterId: string; requesterRole: Role; format: ExportFormat }

export class ExportScheduleUseCase implements UseCase<ExportInput, ExportResult> {
  constructor(
    private weekly: GetWeeklyScheduleUseCase,
    private users: UserRepository,
    private exporters: Record<ExportFormat, BaseExporter>,
  ) {}

  async execute(i: ExportInput): Promise<ExportResult> {
    const user = await this.users.findById(i.requesterId);
    if (!user) throw notFound('Usuario no encontrado');
    const { sessions } = await this.weekly.execute({ requesterId: i.requesterId, requesterRole: i.requesterRole });
    return this.exporters[i.format].export(sessions, user.name);
  }
}
