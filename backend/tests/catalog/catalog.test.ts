import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreateFacultyUseCase, CreateProgramUseCase, DeleteProgramUseCase, ListCatalogUseCase, UpdateProgramUseCase,
} from '../../src/modules/catalog/application/CatalogUseCases';
import { InMemoryCatalog } from '../helpers/inMemory';

let repo: InMemoryCatalog;
beforeEach(() => { repo = new InMemoryCatalog(); });

describe('Catálogo de programas y facultades (RF-ADM-01, RRF-03)', () => {
  it('crea facultades sin duplicados (insensible a mayúsculas)', async () => {
    const uc = new CreateFacultyUseCase(repo);
    await uc.execute({ name: 'Ingeniería' });
    await expect(uc.execute({ name: 'ingeniería' })).rejects.toMatchObject({ status: 409 });
    await expect(uc.execute({ name: '  ' })).rejects.toMatchObject({ status: 400 });
  });
  it('TODO programa debe tener una facultad existente y un código único', async () => {
    const f = await new CreateFacultyUseCase(repo).execute({ name: 'Ingeniería' });
    const create = new CreateProgramUseCase(repo);
    await expect(create.execute({ code: 'ISI', name: 'Sistemas', facultyId: 'no-existe' })).rejects.toMatchObject({ status: 400 });
    const p = await create.execute({ code: 'isi', name: 'Ingeniería de Sistemas', facultyId: f.id });
    expect(p.code).toBe('ISI');
    await expect(create.execute({ code: 'ISI', name: 'Otro', facultyId: f.id })).rejects.toMatchObject({ status: 409 });
    expect((await new ListCatalogUseCase(repo).execute())[0].programs).toHaveLength(1);
  });
  it('edita (reclasifica) y elimina programas', async () => {
    const f1 = await new CreateFacultyUseCase(repo).execute({ name: 'A' });
    const f2 = await new CreateFacultyUseCase(repo).execute({ name: 'B' });
    const p = await new CreateProgramUseCase(repo).execute({ code: 'X1', name: 'Uno', facultyId: f1.id });
    const up = new UpdateProgramUseCase(repo);
    expect(await up.execute({ id: p.id, name: 'Dos', facultyId: f2.id })).toMatchObject({ name: 'Dos', facultyId: f2.id });
    await expect(up.execute({ id: p.id, facultyId: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(up.execute({ id: 'nope', name: 'x' })).rejects.toMatchObject({ status: 404 });
    await new DeleteProgramUseCase(repo).execute({ id: p.id });
    await expect(new DeleteProgramUseCase(repo).execute({ id: p.id })).rejects.toMatchObject({ status: 404 });
  });
});
