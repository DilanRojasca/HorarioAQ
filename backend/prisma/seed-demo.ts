/**
 * Datos de DEMOSTRACIÓN: varios estudiantes de distintas carreras con horarios y huecos diferentes, dos administradores,
 * usuarios sin verificar / sin matrícula, notificaciones (leídas y sin leer), notificaciones programadas, actividades en
 * huecos y rastro de auditoría. Todo pasa por los mismos casos de uso que usa la API (no se inserta a mano lo que el sistema calcula).
 *
 *   npm run seed:demo
 *
 * Es re-ejecutable: BORRA y vuelve a crear horarios, notificaciones, huecos, eventos y corridas (los usuarios se conservan).
 * Se niega a correr en producción.
 */
import 'dotenv/config';
import { prisma } from '../src/shared/prisma';
import { Argon2Hasher } from '../src/modules/auth/infrastructure/Argon2Hasher';
import { config } from '../src/shared/config';
import { wire } from '../src/main';
import { DEMO_PLAN_BY_EMAIL, PLANS } from '../src/modules/schedule/infrastructure/demoPlans';
import { assertSafeSeed, PUBLIC_SEED_PASSWORD } from '../src/shared/safeConfig';

type Demo = {
  name: string; email: string; role?: 'ADMIN' | 'STUDENT'; enrolled?: boolean; verified?: boolean;
  doc?: [string, string]; channel?: 'IN_APP' | 'EMAIL' | 'BOTH'; lead?: number;
};

const USERS: Demo[] = [
  { name: 'Administrador UNI', email: 'admin@horariouni.test', role: 'ADMIN', enrolled: false },
  { name: 'Coordinación Académica', email: 'coordinacion@amigo.edu.co', role: 'ADMIN', enrolled: false, doc: ['CC', '52100200'] },
  { name: 'Dilan Rojas', email: 'dilan@horariouni.test', doc: ['CC', '1017234567'] },
  { name: 'Sebastian Velez', email: 'sebastian@horariouni.test', doc: ['CC', '1036987654'], channel: 'IN_APP' },
  { name: 'Andrés Martínez', email: 'andres.martinez@amigo.edu.co', doc: ['CC', '1020304050'] },
  { name: 'Laura Gómez', email: 'laura.gomez@amigo.edu.co', doc: ['CC', '1011223344'], channel: 'EMAIL', lead: 30 },
  { name: 'Sofía Castaño', email: 'sofia.castano@amigo.edu.co', doc: ['TI', '1099887766'], lead: 10 },
  { name: 'Camila Torres', email: 'camila.torres@amigo.edu.co', doc: ['CC', '1055667788'] },
  { name: 'Juan Herrera', email: 'juan.herrera@amigo.edu.co', doc: ['CC', '1077889900'], lead: 60 },
  { name: 'Valentina Ríos', email: 'valentina.rios@amigo.edu.co', doc: ['CE', '99001122'] },
  { name: 'Mateo Zapata', email: 'mateo.zapata@amigo.edu.co', doc: ['CC', '1044556677'] },
  { name: 'Estudiante Sin Matrícula', email: 'sinmatricula@horariouni.test', enrolled: false },
  { name: 'Pendiente de Verificar', email: 'pendiente.verificar@amigo.edu.co', enrolled: false, verified: false, doc: ['CC', '1000000001'] },
];

const CATALOG: Record<string, Array<[string, string]>> = {
  'Facultad de Ingeniería': [['ISI', 'Ingeniería de Sistemas'], ['IIN', 'Ingeniería Industrial'], ['ICI', 'Ingeniería Civil']],
  'Facultad de Ciencias de la Salud': [['PSI', 'Psicología'], ['ENF', 'Enfermería']],
  'Facultad de Ciencias Administrativas': [['ADM', 'Administración de Empresas'], ['CPU', 'Contaduría Pública']],
  'Facultad de Educación': [['LED', 'Licenciatura en Educación Infantil']],
};

const inDays = (d: number, hour: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(hour, 0, 0, 0); return x; };

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('seed:demo no se ejecuta en producción');
  assertSafeSeed(process.env.NODE_ENV, process.env.SEED_PASSWORD);
  const password = process.env.SEED_PASSWORD || PUBLIC_SEED_PASSWORD;
  const hash = await new Argon2Hasher().hash(password);
  const app = wire();

  // 1. Estado limpio de lo que se vuelve a generar (los usuarios y el catálogo se conservan).
  await prisma.$transaction([
    prisma.eventDelivery.deleteMany(), prisma.domainEvent.deleteMany(), prisma.notification.deleteMany(), prisma.scheduledNotification.deleteMany(),
    prisma.gapActivity.deleteMany(), prisma.gapSlot.deleteMany(), prisma.scheduleChange.deleteMany(), prisma.classSession.deleteMany(), prisma.syncRun.deleteMany(),
  ]);

  // 2. Usuarios y matrículas
  const ids = new Map<string, string>();
  for (const u of USERS) {
    const verified = u.verified !== false;
    const data = {
      name: u.name, role: u.role ?? 'STUDENT', active: verified, verifiedAt: verified ? new Date() : null,
      documentType: u.doc?.[0] ?? null, documentNumber: u.doc?.[1] ?? null, notifyChannel: u.channel ?? 'BOTH', reminderMinutes: u.lead ?? 15,
    };
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, passwordHash: hash, ...data },
      update: data, // la contraseña de un usuario existente no se pisa
    });
    ids.set(u.email, user.id);
    if (u.enrolled !== false && verified && (u.role ?? 'STUDENT') === 'STUDENT') {
      await prisma.enrollment.upsert({
        where: { userId_semester: { userId: user.id, semester: config.semester } },
        create: { userId: user.id, semester: config.semester, active: true }, update: { active: true },
      });
    }
  }
  const adminId = ids.get('admin@horariouni.test')!;

  // 3. Catálogo
  for (const [name, programs] of Object.entries(CATALOG)) {
    const faculty = await prisma.faculty.upsert({ where: { name }, create: { name }, update: {} });
    for (const [code, pname] of programs) await prisma.program.upsert({ where: { code }, create: { code, name: pname, facultyId: faculty.id }, update: {} });
  }

  // 4. Carga inicial de horarios (adaptador mock: un plan por carrera). Es silenciosa: no genera notificaciones.
  const sync = await app.sync.execute({ trigger: 'MANUAL', actorId: adminId });
  await app.bus.idle();

  // 5. Huecos: actividad propia y hueco ocupado (por los casos de uso, que validan que el hueco exista)
  for (const [email, title] of [['laura.gomez@amigo.edu.co', 'Biblioteca: leer para Desarrollo Humano'], ['dilan@horariouni.test', 'Gimnasio'], ['valentina.rios@amigo.edu.co', 'Reunión del semillero']] as const) {
    const userId = ids.get(email)!;
    const gaps = await app.listGaps.execute({ userId });
    if (gaps[0]) await app.assignActivity.execute({ userId, gap: gaps[0], title });
    if (gaps[1]) await app.setGapStatus.execute({ userId, gap: gaps[1], status: 'OCCUPIED' });
  }

  // 6. Notificaciones ya recibidas (algunas leídas) para que la campana tenga contenido
  const note = async (email: string, kind: 'SCHEDULE_UPDATED' | 'SCHEDULE_CANCELLED' | 'SCHEDULE_ADDED' | 'CLASS_REMINDER' | 'CUSTOM', title: string, message: string, read = false) => {
    const n = await app.notifications.create({ userId: ids.get(email)!, kind, title, message });
    if (read) await app.notifications.markRead(ids.get(email)!, n.id);
  };
  await note('dilan@horariouni.test', 'SCHEDULE_UPDATED', 'Cambio en Algoritmos', 'Aula: 201 → 305 · Bloque: A → B · Piso: 2 → 3');
  await note('dilan@horariouni.test', 'CLASS_REMINDER', 'Recordatorio: Inglés', 'Tu clase de Inglés empieza a las 07:00 (en menos de 15 min). Bloque D, Aula 102.', true);
  await note('dilan@horariouni.test', 'CUSTOM', 'Entrega del taller', 'Subir el taller de Bases de Datos a la plataforma.');
  await note('laura.gomez@amigo.edu.co', 'SCHEDULE_CANCELLED', 'Clase cancelada: Ética Profesional', 'La clase de Ética Profesional del Miércoles (10:10–12:00) fue cancelada.');
  await note('laura.gomez@amigo.edu.co', 'SCHEDULE_ADDED', 'Nueva clase: Taller de Casos Clínicos', 'Taller de Casos Clínicos los Sábado de 08:00 a 10:00 en Bloque A, Aula 104.', true);
  await note('camila.torres@amigo.edu.co', 'SCHEDULE_UPDATED', 'Cambio en Mercadeo', 'Aula: 214 → 301 · Bloque: C → D · Piso: 2 → 3');
  await note('sebastian@horariouni.test', 'CLASS_REMINDER', 'Recordatorio: Cálculo', 'Tu clase de Cálculo empieza a las 08:00 (en menos de 15 min). Bloque B, Aula 105.');

  // 7. Notificaciones programadas (RF-NOT-01): el job las entrega a su hora
  for (const [email, title, message, days, hour] of [
    ['dilan@horariouni.test', 'Parcial de Bases de Datos', 'Repasar normalización y consultas con JOIN.', 1, 7],
    ['laura.gomez@amigo.edu.co', 'Entregar informe de Estadística', 'Subir el informe final antes de las 11:59 p. m.', 2, 18],
    ['juan.herrera@amigo.edu.co', 'Reunión del semillero', 'Llevar los avances del proyecto.', 3, 15],
  ] as const) await app.scheduled.create({ userId: ids.get(email)!, kind: 'CUSTOM', title, message, fireAt: inDays(days, hour) });

  // 8. Rastro de auditoría: inicios de sesión (uno fallido) y una consulta de horario de terceros por el administrador
  for (const email of ['admin@horariouni.test', 'dilan@horariouni.test', 'laura.gomez@amigo.edu.co', 'camila.torres@amigo.edu.co']) {
    await app.login.execute({ email, password });
  }
  await app.login.execute({ email: 'dilan@horariouni.test', password: 'incorrecta' }).catch(() => undefined);
  await app.getWeekly.execute({ requesterId: adminId, requesterRole: 'ADMIN', targetUserId: ids.get('laura.gomez@amigo.edu.co')! });
  await app.bus.idle();

  // Resumen
  const counts = {
    usuarios: await prisma.user.count(), horarios: await prisma.classSession.count(), notificaciones: await prisma.notification.count(),
    programadas: await prisma.scheduledNotification.count(), huecosAsignados: await prisma.gapActivity.count(), auditoria: await prisma.auditLog.count(),
  };
  console.log('\nSeed de demostración OK. Sincronización inicial:', sync, '\n', counts, '\n');
  console.log(`Contraseña de TODOS los usuarios nuevos: ${process.env.SEED_PASSWORD ? '(la de SEED_PASSWORD)' : password}\n`);
  console.table(USERS.map((u) => ({
    correo: u.email, rol: u.role ?? 'STUDENT',
    carrera: DEMO_PLAN_BY_EMAIL[u.email] !== undefined && (u.role ?? 'STUDENT') === 'STUDENT' && u.enrolled !== false ? PLANS[DEMO_PLAN_BY_EMAIL[u.email]].name : '—',
    nota: u.verified === false ? 'sin verificar (login 403)' : u.enrolled === false && !u.role ? 'sin matrícula' : '',
  })));
  console.log('Tras el seed, "Sincronizar ahora" (admin) produce cambios de aula/cancelación/clase nueva y genera notificaciones reales.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
