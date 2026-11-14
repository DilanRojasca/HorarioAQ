import { ClassSession, Weekday } from '../domain/types';

/** Plantilla de una clase (sin dueño ni semestre). */
export type Tpl = Omit<ClassSession, 'userId' | 'semester' | 'externalId' | 'status'>;

const t = (courseCode: string, courseName: string, teacher: string, weekday: number, startTime: string, endTime: string, block: string, floor: number, room: string): Tpl =>
  ({ courseCode, courseName, teacher, weekday: weekday as Weekday, startTime, endTime, block, floor, room });

/** Qué cambia el «sistema institucional» tras la primera sincronización (para demostrar los avisos de cambio). */
export interface PlanVariant { update: { courseCode: string; over: Partial<Tpl> }; cancel: string; add: Tpl }
export interface Plan { name: string; base: Tpl[]; variant: PlanVariant }

/**
 * Datos de DEMOSTRACIÓN del adaptador mock: un plan de horario por carrera. Cada plan trae huecos de distintos tamaños
 * (<30, 30–60 y >60 min) para que se vean las tres sugerencias del patrón Strategy, y una variante con
 * un cambio de aula, una cancelación y una clase nueva (RF-HOR-05 / RF-NOT-03).
 * El sistema real reemplazaría todo esto implementando `InstitutionalPort`.
 */
export const PLANS: Plan[] = [
  {
    name: 'Ingeniería de Sistemas',
    base: [
      t('ALG101', 'Algoritmos', 'Marta Gómez', 1, '08:00', '10:00', 'A', 2, '201'),
      t('ALG101', 'Algoritmos', 'Marta Gómez', 3, '08:00', '10:00', 'A', 2, '201'),
      t('CAL102', 'Cálculo', 'Luis Ortiz', 2, '10:00', '12:00', 'B', 1, '105'),
      t('CAL102', 'Cálculo', 'Luis Ortiz', 4, '10:00', '12:00', 'B', 1, '105'),
      t('PHY201', 'Física', 'Ana Ruiz', 1, '14:00', '16:00', 'C', 3, '310'),
      t('DBS202', 'Bases de Datos', 'Carlos Peña', 3, '14:00', '16:00', 'A', 2, '204'),
      t('ENG103', 'Inglés', 'Julia Stone', 5, '07:00', '09:00', 'D', 1, '102'),
      t('SOF301', 'Ingeniería de Software', 'Diego Mora', 5, '10:00', '12:00', 'B', 2, '208'),
    ],
    variant: {
      update: { courseCode: 'ALG101', over: { block: 'B', floor: 3, room: '305' } },
      cancel: 'PHY201',
      add: t('LAB301', 'Laboratorio de Software', 'Diego Mora', 4, '14:00', '16:00', 'C', 1, '110'),
    },
  },
  {
    name: 'Psicología',
    base: [
      t('PSI101', 'Psicología General', 'Elena Vargas', 1, '08:00', '10:00', 'A', 1, '103'),
      t('PSI101', 'Psicología General', 'Elena Vargas', 3, '08:00', '10:00', 'A', 1, '103'),
      t('PSI205', 'Desarrollo Humano', 'Tomás Aguirre', 1, '10:30', '12:30', 'B', 2, '207'),
      t('PSI205', 'Desarrollo Humano', 'Tomás Aguirre', 4, '10:30', '12:30', 'B', 2, '207'),
      t('EST110', 'Estadística Aplicada', 'Rosa Beltrán', 2, '09:00', '11:00', 'C', 1, '112'),
      t('EST110', 'Estadística Aplicada', 'Rosa Beltrán', 5, '09:00', '11:00', 'C', 1, '112'),
      t('PSI310', 'Neuropsicología', 'Felipe Naranjo', 2, '14:00', '16:00', 'D', 3, '301'),
      t('PSI310', 'Neuropsicología', 'Felipe Naranjo', 4, '14:00', '16:00', 'D', 3, '301'),
      t('ETI120', 'Ética Profesional', 'Marcela Duque', 3, '10:10', '12:00', 'A', 2, '206'),
      t('ENG103', 'Inglés', 'Julia Stone', 5, '12:15', '14:15', 'D', 1, '102'),
    ],
    variant: {
      update: { courseCode: 'PSI205', over: { block: 'B', floor: 3, room: '301' } },
      cancel: 'ETI120',
      add: t('PSI330', 'Taller de Casos Clínicos', 'Elena Vargas', 6, '08:00', '10:00', 'A', 1, '104'),
    },
  },
  {
    name: 'Administración de Empresas',
    base: [
      t('CON101', 'Contabilidad General', 'Hernán Salcedo', 1, '07:00', '09:00', 'A', 1, '101'),
      t('CON101', 'Contabilidad General', 'Hernán Salcedo', 3, '07:00', '09:00', 'A', 1, '101'),
      t('ECO120', 'Microeconomía', 'Paula Cárdenas', 1, '09:20', '11:20', 'B', 1, '108'),
      t('ECO120', 'Microeconomía', 'Paula Cárdenas', 4, '09:20', '11:20', 'B', 1, '108'),
      t('MKT210', 'Mercadeo', 'Andrés Lozano', 2, '11:00', '13:00', 'C', 2, '214'),
      t('MKT210', 'Mercadeo', 'Andrés Lozano', 5, '11:00', '13:00', 'C', 2, '214'),
      t('GTH230', 'Gestión del Talento Humano', 'Sandra Quintero', 2, '15:00', '17:00', 'D', 2, '220'),
      t('GTH230', 'Gestión del Talento Humano', 'Sandra Quintero', 4, '15:00', '17:00', 'D', 2, '220'),
      t('ENG103', 'Inglés', 'Julia Stone', 5, '07:00', '09:00', 'D', 1, '102'),
    ],
    variant: {
      update: { courseCode: 'MKT210', over: { block: 'D', floor: 3, room: '301' } },
      cancel: 'GTH230',
      add: t('EMP400', 'Emprendimiento', 'Sandra Quintero', 6, '09:00', '11:00', 'D', 2, '221'),
    },
  },
  {
    name: 'Ingeniería Industrial',
    base: [
      t('CAL102', 'Cálculo', 'Luis Ortiz', 1, '08:00', '10:00', 'B', 1, '105'),
      t('CAL102', 'Cálculo', 'Luis Ortiz', 3, '08:00', '10:00', 'B', 1, '105'),
      t('PHY201', 'Física', 'Ana Ruiz', 1, '11:00', '13:00', 'C', 3, '310'),
      t('PHY201', 'Física', 'Ana Ruiz', 3, '11:00', '13:00', 'C', 3, '310'),
      t('IND220', 'Procesos Industriales', 'Gloria Jaramillo', 2, '10:00', '12:00', 'E', 1, '120'),
      t('IND220', 'Procesos Industriales', 'Gloria Jaramillo', 4, '10:00', '12:00', 'E', 1, '120'),
      t('INV315', 'Investigación de Operaciones', 'Camilo Restrepo', 2, '14:00', '16:00', 'A', 3, '312'),
      t('INV315', 'Investigación de Operaciones', 'Camilo Restrepo', 5, '14:00', '16:00', 'A', 3, '312'),
      t('DIB105', 'Dibujo Técnico', 'Natalia Pineda', 6, '08:00', '12:00', 'E', 2, '201'),
    ],
    variant: {
      update: { courseCode: 'PHY201', over: { block: 'A', floor: 1, room: '115' } },
      cancel: 'DIB105',
      add: t('LAB210', 'Laboratorio de Procesos', 'Gloria Jaramillo', 4, '14:00', '16:00', 'E', 1, '121'),
    },
  },
  {
    name: 'Ingeniería de Sistemas (jornada mixta)',
    base: [
      t('ALG101', 'Algoritmos', 'Marta Gómez', 1, '07:00', '09:00', 'A', 2, '201'),
      t('ALG101', 'Algoritmos', 'Marta Gómez', 4, '07:00', '09:00', 'A', 2, '201'),
      t('DBS202', 'Bases de Datos', 'Carlos Peña', 1, '09:45', '11:45', 'A', 2, '204'),
      t('DBS202', 'Bases de Datos', 'Carlos Peña', 3, '09:45', '11:45', 'A', 2, '204'),
      t('SOF301', 'Ingeniería de Software', 'Diego Mora', 2, '08:00', '10:00', 'B', 2, '208'),
      t('SOF301', 'Ingeniería de Software', 'Diego Mora', 5, '08:00', '10:00', 'B', 2, '208'),
      t('ENG103', 'Inglés', 'Julia Stone', 2, '10:20', '12:20', 'D', 1, '102'),
      t('PHY201', 'Física', 'Ana Ruiz', 3, '16:00', '18:00', 'C', 3, '310'),
      t('SEM400', 'Seminario de Grado', 'Diego Mora', 6, '09:00', '11:00', 'B', 2, '209'),
    ],
    variant: {
      update: { courseCode: 'DBS202', over: { block: 'C', floor: 2, room: '210' } },
      cancel: 'PHY201',
      add: t('LAB301', 'Laboratorio de Software', 'Diego Mora', 4, '14:00', '16:00', 'C', 1, '110'),
    },
  },
];

/** Plan de cada usuario de demostración, por correo (el que no aparezca recibe el plan 0). Lo usa `wire()` y el seed de demo. */
export const DEMO_PLAN_BY_EMAIL: Record<string, number> = {
  'dilan@horariouni.test': 0,
  'sebastian@horariouni.test': 3,
  'andres.martinez@amigo.edu.co': 0,
  'laura.gomez@amigo.edu.co': 1,
  'sofia.castano@amigo.edu.co': 1,
  'camila.torres@amigo.edu.co': 2,
  'juan.herrera@amigo.edu.co': 3,
  'valentina.rios@amigo.edu.co': 4,
  'mateo.zapata@amigo.edu.co': 4,
};
