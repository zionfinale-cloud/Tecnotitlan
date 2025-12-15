import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { UnauthorizedError } from '../utils/errorUtils.js';
import { getConfig } from '../services/configService.js';
import logger from '../utils/logger.js';

/**
 * @desc    Middleware para proteger rutas. Verifica el token JWT y carga el usuario,
 *          su rol y TODOS sus permisos en `req.user` en una sola consulta.
 * @route   Cualquier ruta protegida
 * @access  Privado
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  logger.debug('[Protect] Iniciando verificación de autenticación...');

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Obtener el token de la cabecera
      token = req.headers.authorization.split(' ')[1];
      logger.debug('[Protect] Token encontrado.');

      // 2. Verificar el token
      const config = getConfig();
      const decoded = jwt.verify(token, config.JWT_SECRET);
      logger.debug(`[Protect] Token decodificado para usuario ID: ${decoded.id}`);

      // 3. Obtener el usuario, su rol y los permisos del rol en UNA SOLA CONSULTA
      // Esto es clave para la eficiencia. Excluimos la contraseña.
      const userWithRoleAndPermissions = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: {
            select: {
              id: true,
              name: true,
              // Incluimos los nombres de los permisos directamente
              permissions: { select: { name: true } },
            },
          },
        },
      });

      if (!userWithRoleAndPermissions) {
        logger.error(`[Protect] Error: Usuario con ID ${decoded.id} del token no fue encontrado en la BD.`);
        return next(new UnauthorizedError('Usuario no encontrado.'));
      }

      // Construimos el objeto req.user como el resto de la app lo espera
      req.user = {
        ...userWithRoleAndPermissions,
        name: `${userWithRoleAndPermissions.firstName} ${userWithRoleAndPermissions.lastName}`.trim(),
      };
      logger.debug(`[Protect] Usuario ${req.user.name} (Rol: ${req.user.role.name}) autenticado y cargado en req.user.`);
      next();
    } catch (error) {
      logger.error('[Protect] Error de autenticación:', error.message);
      return next(new UnauthorizedError('No autorizado, token inválido o expirado.'));
    }
  }

  if (!token) {
    // Si no hay token, simplemente continuamos. Las rutas que requieran autenticación
    // fallarán en el middleware `checkPermission` si `req.user` no está definido.
    // Esto nos permite tener rutas "opcionalmente autenticadas".
    logger.debug('[Protect] No se encontró token. Continuando como usuario no autenticado.');
    return next();
  }
});

export { protect };