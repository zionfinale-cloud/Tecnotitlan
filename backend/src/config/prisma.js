import { PrismaClient } from '@prisma/client';

// --- PARCHE CRÍTICO PARA SUPABASE EN CPANEL ---
// cPanel a veces inyecta la variable DATABASE_URL antigua desde su interfaz, ignorando el .env.
// Este bloque fuerza la bandera ?pgbouncer=true si detecta que estamos usando el Transaction Pooler.
let connectionUrl = process.env.DATABASE_URL;

if (connectionUrl && 
    connectionUrl.includes('pooler.supabase.com') && 
    !connectionUrl.includes('pgbouncer=true')) {
    
    console.log('⚠️ [Prisma Fix] Detectada URL de Supabase Pooler sin bandera pgbouncer. Corrigiendo automáticamente...');
    connectionUrl = `${connectionUrl}?pgbouncer=true`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl,
    },
  },
  // Opcional: Configuración para logging en desarrollo
  // log: ['query', 'info', 'warn', 'error'],
});

export default prisma;