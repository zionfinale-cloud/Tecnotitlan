import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { UnauthorizedError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';
import { applyEffectivePermissionsToUser } from '../utils/permissionUtils.js';

const authenticate = async (req) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;

  const decoded = jwt.verify(authorization.split(' ')[1], process.env.JWT_SECRET);
  const user = await prisma.user.findUnique({
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

  req.user = applyEffectivePermissionsToUser({
    ...user,
    name: `${user.firstName} ${user.lastName}`.trim(),
  });
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
    return next(error instanceof UnauthorizedError
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
