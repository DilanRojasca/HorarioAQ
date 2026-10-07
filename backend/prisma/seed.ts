import 'dotenv/config';
import { prisma } from '../src/shared/prisma';
import { Argon2Hasher } from '../src/modules/auth/infrastructure/Argon2Hasher';
import { config } from '../src/shared/config';
import { wire } from '../src/main';

async function main() {
  const password = process.env.SEED_PASSWORD ?? 'Cambiar123!';
  const hash = await new Argon2Hasher().hash(password);
  const users = [
    { name: 'Administrador UNI', email: 'admin@horariouni.test', role: 'ADMIN' as const, enrolled: false },
    { name: 'Dilan Rojas', email: 'dilan@horariouni.test', role: 'STUDENT' as const, enrolled: true },
    { name: 'Sebastian Velez', email: 'sebastian@horariouni.test', role: 'STUDENT' as const, enrolled: true },
    { name: 'Estudiante Sin Matrícula', email: 'sinmatricula@horariouni.test', role: 'STUDENT' as const, enrolled: false },
  ];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { name: u.name, email: u.email, role: u.role, passwordHash: hash },
      update: { passwordHash: hash },
    });
    if (u.enrolled) {
      await prisma.enrollment.upsert({
        where: { userId_semester: { userId: user.id, semester: config.semester } },
        create: { userId: user.id, semester: config.semester, active: true },
        update: { active: true },
      });
    }
  }
  // Carga inicial del horario base (1.ª consulta del adaptador mock).
  const r = await wire().sync.execute({ trigger: 'MANUAL', actorId: 'seed' });
  console.log('Seed OK. Sincronización inicial:', r);
}

main().finally(() => prisma.$disconnect());
