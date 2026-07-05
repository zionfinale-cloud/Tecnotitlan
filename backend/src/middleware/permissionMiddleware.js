import { ForbiddenError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';

/**
 * Verifica permisos despues de `protect`.
 * SUPER_ADMIN siempre pasa, incluso si se agrego un permiso nuevo y la sesion todavia no lo refleja.
 */
const checkPermission = (...args) => {
  const requiredPermissions = args.filter((arg) => typeof arg === 'string');
  const options = args.find((arg) => typeof arg === 'object') || {};
  const { requireAll = false } = options;

  return (req, res, next) => {
    const permissionsStr = requiredPermissions.join(requireAll ? ' AND ' : ' OR ');
    logger.debug(`[RBAC] Verificando permisos: [${permissionsStr}] para usuario: ${req.user?.email}`);

    if (!req.user || !req.user.role) {
      logger.error('[RBAC] Error: req.user.role no esta definido. El middleware "protect" no se ejecuto o fallo.');
      return next(new ForbiddenError('No se pudieron verificar los permisos. Acceso denegado.'));
    }

    if (req.user.role.name === 'SUPER_ADMIN') {
      logger.debug('[RBAC] Acceso CONCEDIDO por rol SUPER_ADMIN.');
      return next();
    }

    if (!Array.isArray(req.user.role.permissions)) {
      logger.error('[RBAC] Error: req.user.role.permissions no esta definido.');
      return next(new ForbiddenError('No se pudieron verificar los permisos. Acceso denegado.'));
    }

    const userPermissions = new Set(req.user.role.permissions.map((permission) => permission.name));
    logger.debug(`[RBAC] Permisos del usuario: {${Array.from(userPermissions).join(', ')}}`);

    const hasPermission = requireAll
      ? requiredPermissions.every((permission) => userPermissions.has(permission))
      : requiredPermissions.some((permission) => userPermissions.has(permission));

    if (hasPermission) {
      logger.debug('[RBAC] Acceso CONCEDIDO. El usuario cumple con los requisitos de permisos.');
      return next();
    }

    logger.warn(`[RBAC] Acceso DENEGADO. Rol '${req.user.role.name}', permisos requeridos: [${permissionsStr}].`);
    return next(new ForbiddenError('No tienes los permisos necesarios para realizar esta accion.'));
  };
};

export { checkPermission };
