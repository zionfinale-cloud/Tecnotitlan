import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';
import { applyEffectivePermissionsToUser } from '../utils/permissionUtils.js';
import { AUTH_COOKIE_NAME } from '../utils/authCookies.js';

const authenticate = async (req) => {
  const authorization = req.headers.authorization;
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.split(' ')[1] : null;
  const token = req.cookies?.[AUTH_COOKIE_NAME]
    || (process.env.NODE_ENV === 'production' ? null : bearerToken);
  if (!token) return false;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      tokenVersion: true,
      twoFactorEnabled: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: { select: { id: true, name: true, description: true } },
        },
      },
      permissionGrants: {
        include: { permission: { select: { id: true, name: true, description: true } } },
      },
      permissionDenies: {
        include: { permission: { select: { id: true, name: true, description: true } } },
      },
    },
  });

  if (!user) throw new UnauthorizedError('Usuario no encontrado.');
  if ((decoded.scope && decoded.scope !== 'auth') || Number(decoded.ver || 0) !== user.tokenVersion) {
    throw new UnauthorizedError('La sesion fue reemplazada por un cambio de seguridad.');
  }

  req.user = applyEffectivePermissionsToUser({
    ...user,
    name: `${user.firstName} ${user.lastName}`.trim(),
  });
  const isStaff = req.user.role?.name && req.user.role.name !== 'USER';
  const enrollmentAllowed = /^\/api\/(security(?:\/|$)|users\/(profile|logout)(?:\/|$))/.test(req.originalUrl);
  if (isStaff && !req.user.twoFactorEnabled && !enrollmentAllowed) {
    const error = new ForbiddenError('Debes activar la autenticacion de dos factores antes de continuar.');
    error.code = 'TWO_FACTOR_ENROLLMENT_REQUIRED';
    throw error;
  }
  return true;
};

const protect = asyncHandler(async (req, res, next) => {
  try {
    if (!await authenticate(req)) {
      return next(new UnauthorizedError('No autorizado, no hay token.'));
    }
    return next();
  } catch (error) {
    logger.error('[Protect] Error de autenticacion:', error.message);
    return next(error instanceof UnauthorizedError || error instanceof ForbiddenError
      ? error
      : new UnauthorizedError('No autorizado, token invalido o expirado.'));
  }
});

const optionalProtect = asyncHandler(async (req, res, next) => {
  try {
    await authenticate(req);
    return next();
  } catch (error) {
    logger.error('[OptionalProtect] Token invalido:', error.message);
    return next(new UnauthorizedError('No autorizado, token invalido o expirado.'));
  }
});

export { protect, optionalProtect };
