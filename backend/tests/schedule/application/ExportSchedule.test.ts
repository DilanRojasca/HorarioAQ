import { describe, it, expect } from 'vitest';
import { ExportScheduleUseCase } from '../../../src/modules/schedule/application/ExportSchedule';
import { GetWeeklyScheduleUseCase } from '../../../src/modules/schedule/application/GetWeeklySchedule';
import { IcsExporter } from '../../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { InMemoryEnrollmentRepo, InMemoryScheduleRepo, InMemoryUsers, session } from '../../helpers/inMemory';

const build = () => {
  const repo = new InMemoryScheduleRepo();
  repo.rows = [session()];
  const weekly = new GetWeeklyScheduleUseCase(repo, new InMemoryEnrollmentRepo(['u1']), '2026-2');
  const users = new InMemoryUsers([{ id: 'u1', name: 'Ana Pérez', email: 'a@x.co', passwordHash: '', role: 'STUDENT', active: true }]);
  return new ExportScheduleUseCase(weekly, users, {
    ics: new IcsExporter({ semesterStart: '2026-08-03', weeks: 16 }),
    pdf: new PdfExporter({ semester: '2026-2' }),
  });
};

describe('ExportScheduleUseCase', () => {
  it('exporta ics', async () => {
    const r = await build().execute({ requesterId: 'u1', requesterRole: 'STUDENT', format: 'ics' });
    expect(r.filename).toBe('horario-ana-perez.ics');
    expect(r.body.toString()).toContain('Algoritmos');
  });
  it('exporta pdf', async () => {
    const r = await build().execute({ requesterId: 'u1', requesterRole: 'STUDENT', format: 'pdf' });
    expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
