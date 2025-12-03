import { ForbiddenError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';

 /**
  * @desc    Middleware de autorización que verifica si el usuario tiene los permisos necesarios.
  *          DEBE usarse DESPUÉS del middleware `protect`.
  * @param   {...string} requiredPermissions - Los nombres de los permisos requeridos (ej. 'product:create', 'product:edit').
  * @param   {object} [options] - Opciones para la verificación.
  * @param   {boolean} [options.requireAll=false] - Si es `true`, el usuario debe tener TODOS los permisos. Por defecto, solo necesita UNO.
  * @returns {function} Middleware de Express.
  *
  * @example
  * // El usuario necesita 'product:edit' O 'product:delete'
  * router.delete('/products/:id', protect, checkPermission('product:edit', 'product:delete'), deleteProduct);
  *
  * @example
  * // El usuario necesita 'report:generate' Y 'report:view'
  * router.get('/reports/financial', protect, checkPermission('report:generate', 'report:view', { requireAll: true }), generateFinancialReport);
  */
const checkPermission = (...args) => {
  // Extraer los permisos y las opciones de los argumentos
  const requiredPermissions = args.filter(arg => typeof arg === 'string');
  const options = args.find(arg => typeof arg === 'object') || {};
  const { requireAll = false } = options;

  return (req, res, next) => {
    const permissionsStr = requiredPermissions.join(requireAll ? ' AND ' : ' OR ');
    logger.debug(`[RBAC] Verificando permisos: [${permissionsStr}] para usuario: ${req.user?.email}`);

    // 1. Verificación de seguridad: `protect` debe haberse ejecutado antes.
    if (!req.user || !req.user.role || !Array.isArray(req.user.role.permissions)) {
      logger.error('[RBAC] Error: req.user.role.permissions no está definido. El middleware "protect" no se ejecutó o falló.');
      return next(new ForbiddenError('No se pudieron verificar los permisos. Acceso denegado.'));
    }

    // 2. Extraemos los nombres de los permisos del usuario en un Set para búsqueda rápida (O(1)).
    const userPermissions = new Set(req.user.role.permissions.map(p => p.name));
    logger.debug(`[RBAC] Permisos del usuario: {${Array.from(userPermissions).join(', ')}}`);

    // 3. Verificamos los permisos según la lógica (requireAll o no).
    let hasPermission;
    if (requireAll) {
      // El usuario debe tener TODOS los permisos requeridos.
      hasPermission = requiredPermissions.every(p => userPermissions.has(p));
    } else {
      // El usuario debe tener AL MENOS UNO de los permisos requeridos.
      hasPermission = requiredPermissions.some(p => userPermissions.has(p));
    }

    if (hasPermission) {
      logger.debug(`[RBAC] Acceso CONCEDIDO. El usuario cumple con los requisitos de permisos.`);
      return next();
    }

    logger.warn(`[RBAC] Acceso DENEGADO. El usuario con rol '${req.user.role.name}' no cumple con los permisos requeridos: [${permissionsStr}].`);
    return next(new ForbiddenError('No tienes los permisos necesarios para realizar esta acción.'));
  };
};

export { checkPermission };