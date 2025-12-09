import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  // Opcional: Configuración para logging en desarrollo
  // log: ['query', 'info', 'warn', 'error'],
});

export default prisma;