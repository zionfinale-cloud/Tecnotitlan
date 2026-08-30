import { writeAuditLog } from '../services/auditService.js';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IGNORED_PATHS = ['/api/analytics/view', '/api/chat/tecatl', '/api/stripe/webhook'];

const categoryFor = (path = '') => {
  if (/login|logout|security/i.test(path)) return 'AUTH';
  if (/settings|roles|users/i.test(path)) return 'ADMIN';
  if (/mercadolibre|tiktok|whatsapp|marketplace/i.test(path)) return 'INTEGRATION';
  if (/orders|inventory|returns/i.test(path)) return 'OPERATION';
  return 'GENERAL';
};

export const auditMutations = (req, res, next) => {
  if (!MUTATIONS.has(req.method) || IGNORED_PATHS.some((path) => req.path.startsWith(path) || req.originalUrl.startsWith(path))) {
    return next();
  }
  res.on('finish', () => {
    const publicAuthAttempt = /\/api\/(users\/(login|logout)|security\/2fa\/verify-login)/.test(req.originalUrl);
    if (!req.user && !req.auditActor && !publicAuthAttempt) return;
    void writeAuditLog({
      req,
      category: categoryFor(req.originalUrl),
      action: `${req.method} ${req.originalUrl.split('?')[0]}`,
      entityId: req.params?.id,
      statusCode: res.statusCode,
    });
  });
  return next();
};
