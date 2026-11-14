import { PrismaClient } from '@prisma/client';
/** @pattern Singleton | Cliente de base de datos único | Un solo PrismaClient por proceso: evita agotar las conexiones de PostgreSQL. */
export const prisma = new PrismaClient(); // Singleton: un solo pool por proceso
