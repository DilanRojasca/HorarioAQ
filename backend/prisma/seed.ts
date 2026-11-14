import 'dotenv/config';
import { prisma } from '../src/shared/prisma';
import { Argon2Hasher } from '../src/modules/auth/infrastructure/Argon2Hasher';
import { config } from '../src/shared/config';
import { wire } from '../src/main';
import { assertSafeSeed, PUBLIC_SEED_PASSWORD } from '../src/shared/safeConfig';

async function main() {
  assertSafeSeed(process.env.NODE_ENV, process.env.SEED_PASSWORD);
  const password = process.env.SEED_PASSWORD || PUBLIC_SEED_PASSWORD;
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
      create: { name: u.name, email: u.email, role: u.role, passwordHash: hash, verifiedAt: new Date() },
      update: {}, // no se pisa la contraseña de un usuario existente
    });
    if (u.enrolled) {
      await prisma.enrollment.upsert({
        where: { userId_semester: { userId: user.id, semester: config.semester } },
        create: { userId: user.id, semester: config.semester, active: true },
        update: { active: true },
      });
    }
  }
  // Catálogo académico de ejemplo (RF-ADM-01 / RRF-03: todo programa pertenece a una facultad).
  const catalog: Record<string, Array<[string, string]>> = {
    'Facultad de Ingeniería': [['ISI', 'Ingeniería de Sistemas'], ['IIN', 'Ingeniería Industrial']],
    'Facultad de Ciencias de la Salud': [['PSI', 'Psicología']],
    'Facultad de Ciencias Administrativas': [['ADM', 'Administración de Empresas']],
  };
  for (const [name, programs] of Object.entries(catalog)) {
    const faculty = await prisma.faculty.upsert({ where: { name }, create: { name }, update: {} });
    for (const [code, pname] of programs) {
      await prisma.program.upsert({ where: { code }, create: { code, name: pname, facultyId: faculty.id }, update: {} });
    }
  }
  // Carga inicial del horario base (1.ª consulta del adaptador mock).
  const app = wire();
  const r = await app.sync.execute({ trigger: 'MANUAL', actorId: 'seed' });
  await app.bus.idle(); // espera a los observadores en curso (auditoría, historial) antes de desconectar
  console.log('Seed OK. Sincronización inicial:', r);
}

main().finally(() => prisma.$disconnect());
