import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import whatsappRoutes from './routes/whatsappRoutes.js'; // Importar nuevas rutas

const app = express();
const server = http.createServer(app); // Crear servidor HTTP para Express

// --- Confianza en el Proxy ---
app.set('trust proxy', 1);
const io = new Server(server, { cors: { origin: '*' } }); // Inicializar Socket.IO

let serverReadyPromise;

const startServer = async () => {
  try {
    // Conexión a Prisma usando la instancia importada
    await prisma.$connect();
    logger.info('Successfully connected to the database with Prisma.');

    await initializeConfig();
    logger.info('Configuration loaded from DB.');

    // Pasar la instancia de Socket.IO al servicio de WhatsApp
    whatsappService.setSocketIO(io);

    app.use(express.json());
    app.use(cors());
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

    // --- Middleware de Sesión (necesario para OAuth 2.0 como Mercado Libre) ---
    app.use(
      session({
        secret: getConfig().JWT_SECRET, // Reutilizamos el JWT secret para la sesión
        resave: false,
        saveUninitialized: true,
        cookie: { secure: getConfig().NODE_ENV === 'production' }, // Usar cookies seguras en producción
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
    app.use('/api/integrations/whatsapp', whatsappRoutes); // Usar nuevas rutas

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

process.on('beforeExit', async () => {
  // Este evento puede ser ruidoso. Es mejor manejar la desconexión en el cierre del servidor.
  // await prisma.$disconnect();
  // logger.info('Prisma client disconnected.');
}); 

export { app, serverReadyPromise as ready };