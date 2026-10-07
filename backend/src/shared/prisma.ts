import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient(); // Singleton: un solo pool por proceso
