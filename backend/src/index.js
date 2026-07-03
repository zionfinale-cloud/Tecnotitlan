import 'dotenv/config'; // Carga las variables de entorno inmediatamente, antes de otros imports

import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pgSimple from 'connect-pg-simple';
import session from 'express-session';
import prisma from './config/prisma.js'; // <-- IMPORTACIÓN CORREGIDA
import logger from './utils/logger.js';
import { initializeConfig, getConfig } from './services/configService.js';
import * as whatsappService from './services/whatsappService.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Importar todas tus rutas
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import mercadoLibreRoutes from './routes/mercadoLibreRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import supportTicketRoutes from './routes/supportTicketRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';

const app = express();
const server = http.createServer(app); // Crear servidor HTTP para Express

// --- Confianza en el Proxy ---
app.set('trust proxy', 1);
const allowedOrigins = [
  getConfig().CLIENT_URL_PRIMARY,
  getConfig().CLIENT_URL_SECONDARY,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS.'));
  },
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });

let serverReadyPromise;

const startServer = async () => {
  try {
    // Conexión a Prisma usando la instancia importada
    // Implementamos un mecanismo de reintento para manejar inestabilidades transitorias en cPanel
    let connected = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (!connected && attempts < MAX_ATTEMPTS) {
      try {
        await prisma.$connect();
        connected = true;
        logger.info('Successfully connected to the database with Prisma.');
      } catch (err) {
        attempts++;
        logger.error(`Database connection attempt ${attempts} failed: ${err.message}. Retrying in 2s...`);
        if (attempts >= MAX_ATTEMPTS) throw err;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    await initializeConfig();
    logger.info('Configuration loaded from DB.');

    // Pasar la instancia de Socket.IO al servicio de WhatsApp
    whatsappService.setSocketIO(io);

    app.use(express.json());
    app.use(cors(corsOptions));
    app.use(helmet());

    // Middleware para añadir un delay en pruebas de Cypress
    app.use((req, res, next) => {
      const delay = parseInt(req.headers['x-cypress-delay'], 10);
      if (process.env.NODE_ENV !== 'production' && delay > 0) {
        setTimeout(next, delay);
      } else {
        next();
      }
    });

    // --- Configuración de Almacén de Sesiones Persistente ---
    const PGStore = pgSimple(session);
    const sessionStore = new PGStore({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions', // Nombre de la tabla para las sesiones
      createTableIfMissing: true, // Crea la tabla automáticamente si no existe
    });

    // --- Middleware de Sesión (necesario para OAuth 2.0 como Mercado Libre) ---
    app.use(
      session({
        store: sessionStore,
        secret: getConfig().JWT_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: getConfig().NODE_ENV === 'production',
          httpOnly: true,
          sameSite: getConfig().NODE_ENV === 'production' ? 'none' : 'lax',
        },
      })
    );


    // --- Seguridad: Rate Limiting ---
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 10, // Limita cada IP a 10 peticiones de login/registro por ventana de tiempo
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 'error',
        message: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo después de 15 minutos.',
      },
      skip: (req, res) => process.env.NODE_ENV === 'test',
    });

    // Middleware para ignorar las peticiones de favicon.ico y evitar errores 404 en la consola
    app.get('/favicon.ico', (req, res) => res.status(204).send());

    logger.info('Mounting API routes...');
    // Aplicar el limitador específicamente a las rutas de autenticación
    app.use('/api/users/login', authLimiter);
    app.use('/api/users/register', authLimiter);
    app.use('/api/products', productRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/settings', settingRoutes); // Unificado
    app.use('/api/roles', roleRoutes);
    app.use('/api/mercadolibre', mercadoLibreRoutes);
    app.use('/api/integrations/whatsapp', whatsappRoutes);
    app.use('/api/support/tickets', supportTicketRoutes);
    app.use('/api/inventory', inventoryRoutes);

    const __dirname = path.resolve();
    app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

    // Ruta raíz para verificar que la API está en línea
   app.get('/', (req, res) => {
     res.status(200).send(`
          <div style="font-family: sans-serif; padding: 2rem; text-align: center;">
            <h1 style="color: #333;">🚀 API de Tecnotitlan en ejecución</h1>
            <p style="font-size: 1.2rem; color: #555;">El backend está funcionando correctamente en modo <strong>${getConfig().NODE_ENV}</strong>.</p>
          </div>
        `);
      });

    app.use(notFound);
    app.use(errorHandler);

    // Iniciar el servidor. Esta es la forma estándar de mantener el proceso vivo.
    const PORT = getConfig().PORT || 5000;
    server.listen(PORT, () => {
      logger.success(`Server running in ${getConfig().NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

serverReadyPromise = startServer();

// --- MANEJO DE CIERRE (Graceful Shutdown) ---
// Vital para cPanel: Asegura que los procesos viejos mueran realmente al reiniciar.
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} recibido. Cerrando servidor ordenadamente...`);
  
  if (server) {
    server.close(() => {
      logger.info('Servidor HTTP cerrado.');
    });
  }

  // Desconectar Prisma para liberar la conexión a la BD
  await prisma.$disconnect();
  logger.info('Cliente Prisma desconectado.');
  
  process.exit(0);
};

// Escuchar señales de terminación de cPanel/Passenger
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, serverReadyPromise as ready };
