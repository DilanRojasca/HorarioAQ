import { badRequest, conflict, notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';

export interface ProgramRecord { id: string; code: string; name: string; facultyId: string }
export interface FacultyRecord { id: string; name: string; programs: ProgramRecord[] }

/** PATRÓN Repository del catálogo académico (RF-ADM-01, RRF-03). */
export interface CatalogRepository {
  listFaculties(): Promise<FacultyRecord[]>;
  findFaculty(id: string): Promise<{ id: string; name: string } | null>;
  createFaculty(name: string): Promise<{ id: string; name: string }>;
  findProgramByCode(code: string): Promise<ProgramRecord | null>;
  findProgram(id: string): Promise<ProgramRecord | null>;
  createProgram(p: { code: string; name: string; facultyId: string }): Promise<ProgramRecord>;
  updateProgram(id: string, p: { name?: string; facultyId?: string }): Promise<ProgramRecord>;
  deleteProgram(id: string): Promise<void>;
}

const text = (v: string, field: string, max = 120) => {
  const t = v.trim();
  if (!t || t.length > max) throw badRequest(`${field} debe tener entre 1 y ${max} caracteres`);
  return t;
};

export class ListCatalogUseCase implements UseCase<void, FacultyRecord[]> {
  constructor(private repo: CatalogRepository) {}
  execute() { return this.repo.listFaculties(); }
}

export class CreateFacultyUseCase implements UseCase<{ name: string }, { id: string; name: string }> {
  constructor(private repo: CatalogRepository) {}
  async execute({ name }: { name: string }) {
    const n = text(name, 'El nombre');
    if ((await this.repo.listFaculties()).some((f) => f.name.toLowerCase() === n.toLowerCase())) throw conflict('Ya existe esa facultad');
    return this.repo.createFaculty(n);
  }
}

/** RRF-03: todo programa se clasifica OBLIGATORIAMENTE en una facultad existente. */
export class CreateProgramUseCase implements UseCase<{ code: string; name: string; facultyId: string }, ProgramRecord> {
  constructor(private repo: CatalogRepository) {}
  async execute(i: { code: string; name: string; facultyId: string }) {
    const code = text(i.code, 'El código', 20).toUpperCase();
    const name = text(i.name, 'El nombre');
    if (!(await this.repo.findFaculty(i.facultyId))) throw badRequest('Todo programa debe pertenecer a una facultad existente');
    if (await this.repo.findProgramByCode(code)) throw conflict('Ya existe un programa con ese código');
    return this.repo.createProgram({ code, name, facultyId: i.facultyId });
  }
}

export class UpdateProgramUseCase implements UseCase<{ id: string; name?: string; facultyId?: string }, ProgramRecord> {
  constructor(private repo: CatalogRepository) {}
  async execute(i: { id: string; name?: string; facultyId?: string }) {
    if (!(await this.repo.findProgram(i.id))) throw notFound('Programa no encontrado');
    if (i.facultyId && !(await this.repo.findFaculty(i.facultyId))) throw badRequest('Todo programa debe pertenecer a una facultad existente');
    return this.repo.updateProgram(i.id, { name: i.name === undefined ? undefined : text(i.name, 'El nombre'), facultyId: i.facultyId });
  }
}

export class DeleteProgramUseCase implements UseCase<{ id: string }, void> {
  constructor(private repo: CatalogRepository) {}
  async execute({ id }: { id: string }) {
    if (!(await this.repo.findProgram(id))) throw notFound('Programa no encontrado');
    await this.repo.deleteProgram(id);
  }
}
