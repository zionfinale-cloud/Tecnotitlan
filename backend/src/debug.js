// Este es un script de depuración especial para aislar la causa del error "Aborted (core dumped)".
// Iniciaremos los componentes uno por uno para ver cuál de ellos causa el crash.

import 'dotenv/config';
import logger from './utils/logger.js';

async function runDebug() {
  try {
    logger.info('[DEBUG STEP 1/5] Logger y dotenv cargados correctamente.');

    // --- Prueba de Conexión de Prisma ---
    // Prisma es un sospechoso principal por ser un binario nativo.
    logger.info('[DEBUG STEP 2/5] Intentando importar el cliente de Prisma...');
    const { default: prisma } = await import('./config/prisma.js');
    logger.info('[DEBUG STEP 2/5] Cliente de Prisma importado. Conectando a la base de datos...');
    await prisma.$connect();
    logger.success('[DEBUG STEP 2/5] ¡Prisma se conectó y desconectó exitosamente!');
    await prisma.$disconnect();

    // --- Prueba de Express ---
    // Verificamos que el servidor web básico se pueda inicializar.
    logger.info('[DEBUG STEP 3/5] Intentando importar Express...');
    const { default: express } = await import('express');
    const app = express();
    app.get('/', (req, res) => res.send('OK'));
    logger.success('[DEBUG STEP 3/5] Express importado e inicializado correctamente.');

    // --- Prueba de WhatsApp Service (Baileys) ---
    // Verificamos la carga de la librería de sockets (Baileys).
    logger.info('[DEBUG STEP 4/5] Intentando importar el servicio de WhatsApp (esto carga Baileys)...');
    await import('./services/whatsappService.js');
    // Solo importar el archivo es suficiente para detectar un crash en la inicialización de Baileys.
    logger.success('[DEBUG STEP 4/5] El servicio de WhatsApp se importó correctamente (Baileys parece estable).');

    // --- Prueba de Arranque Completo ---
    // Si llegamos hasta aquí, intentamos el arranque completo del servidor.
    logger.info('[DEBUG STEP 5/5] Todos los módulos parecen estables. Intentando arranque completo del servidor...');
    await import('./index.js');
    logger.success('[DEBUG STEP 5/5] El arranque completo del servidor se inició sin un crash inmediato.');

  } catch (error) {
    logger.error('[DEBUG] Ocurrió un error durante la secuencia de depuración:');
    logger.error(error);
    process.exit(1);
  }
}

runDebug();