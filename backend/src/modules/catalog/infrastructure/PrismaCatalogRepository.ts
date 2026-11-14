import { prisma } from '../../../shared/prisma';
import { CatalogRepository } from '../application/CatalogUseCases';

/** @pattern Repository | Implementación con Prisma/PostgreSQL | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. */
export class PrismaCatalogRepository implements CatalogRepository {
  listFaculties() {
    return prisma.faculty.findMany({ orderBy: { name: 'asc' }, include: { programs: { orderBy: { name: 'asc' } } } });
  }
  findFaculty(id: string) { return prisma.faculty.findUnique({ where: { id } }); }
  createFaculty(name: string) { return prisma.faculty.create({ data: { name } }); }
  findProgramByCode(code: string) { return prisma.program.findUnique({ where: { code } }); }
  findProgram(id: string) { return prisma.program.findUnique({ where: { id } }); }
  createProgram(p: { code: string; name: string; facultyId: string }) { return prisma.program.create({ data: p }); }
  updateProgram(id: string, p: { name?: string; facultyId?: string }) { return prisma.program.update({ where: { id }, data: p }); }
  async deleteProgram(id: string) { await prisma.program.delete({ where: { id } }); }
}
