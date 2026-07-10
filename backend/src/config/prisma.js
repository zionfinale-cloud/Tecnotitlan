import './env.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

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

// Log de diagnóstico (Ocultando credenciales)
console.log(`[Prisma Config] Conectando a: ${connectionUrl?.replace(/:([^:@]+)@/, ':****@')}`);

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
