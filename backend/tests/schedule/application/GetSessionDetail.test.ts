import { describe, it, expect } from 'vitest';
import { GetSessionDetailUseCase } from '../../../src/modules/schedule/application/GetSessionDetail';
import { InMemoryScheduleRepo, session } from '../../helpers/inMemory';

const uc = () => {
  const repo = new InMemoryScheduleRepo();
  repo.rows = [session()];
  return new GetSessionDetailUseCase(repo);
};

describe('GetSessionDetailUseCase', () => {
  it('devuelve el detalle de una clase propia', async () => {
    const s = await uc().execute({ requesterId: 'u1', requesterRole: 'STUDENT', externalId: 'u1-ALG-1' });
    expect(s).toMatchObject({ courseName: 'Algoritmos', teacher: 'Marta', block: 'A', floor: 2, room: '201' });
  });
  it('404 si no existe', async () => {
    await expect(uc().execute({ requesterId: 'u1', requesterRole: 'STUDENT', externalId: 'nope' }))
      .rejects.toMatchObject({ status: 404 });
  });
  it('403 si estudiante pide la de otro', async () => {
    await expect(uc().execute({ requesterId: 'u2', requesterRole: 'STUDENT', externalId: 'u1-ALG-1', ownerId: 'u1' }))
      .rejects.toMatchObject({ status: 403 });
  });
});
