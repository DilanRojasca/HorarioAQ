import { prisma } from '../../../shared/prisma';
import { EnrollmentRepository } from '../application/ports';

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  async listActiveStudentIds(semester: string) {
    const rows = await prisma.enrollment.findMany({
      where: { semester, active: true, user: { role: 'STUDENT', active: true } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
  async hasActive(userId: string, semester: string) {
    return (await prisma.enrollment.count({ where: { userId, semester, active: true } })) > 0;
  }
}
