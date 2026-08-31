import { emitRealtimeMany } from '../services/realtimeService.js';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const READ_ONLY_POSTS = [
  /^\/api\/staff-mail\/messages(?:\/[^/]+)?(?:\?|$)/,
  /^\/api\/users\/(?:login|logout|resend-verification)(?:\?|$)/,
  /^\/api\/security\/2fa\/verify-login(?:\?|$)/,
];

export const topicsForPath = (path = '') => {
  if (/\/mercadolibre/.test(path)) return ['meli', 'marketplaces', 'orders', 'inventory', 'inbox', 'dashboard'];
  if (/\/products|\/categories/.test(path)) return ['products', 'catalog', 'inventory', 'marketplaces', 'dashboard'];
  if (/\/orders/.test(path)) return ['orders', 'inventory', 'dashboard'];
  if (/\/inventory/.test(path)) return ['inventory', 'products', 'marketplaces', 'dashboard'];
  if (/\/investments/.test(path)) return ['finance', 'inventory', 'dashboard'];
  if (/\/return-inspections/.test(path)) return ['returns', 'orders', 'inventory', 'dashboard'];
  if (/\/service-quality/.test(path)) return ['quality', 'inbox', 'dashboard'];
  if (/\/unified-inbox|\/support|\/staff-mail|\/whatsapp|\/tecatl/.test(path)) return ['inbox', 'messages', 'quality', 'dashboard'];
  if (/\/settings/.test(path)) return ['settings', 'catalog'];
  if (/\/users|\/roles|\/security/.test(path)) return ['users', 'security'];
  if (/\/tiktok|\/marketplaces/.test(path)) return ['marketplaces', 'products', 'orders', 'inventory'];
  return ['dashboard'];
};

export const notifyRealtimeMutations = (req, res, next) => {
  if (
    !MUTATIONS.has(req.method)
    || req.originalUrl.startsWith('/api/analytics/view')
    || req.originalUrl.startsWith('/api/mercadolibre/notifications')
    || READ_ONLY_POSTS.some((pattern) => pattern.test(req.originalUrl))
  ) return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const topics = topicsForPath(req.originalUrl);
    emitRealtimeMany(topics, `${req.method} ${req.originalUrl.split('?')[0]}`);
    const publicTopics = topics.filter((topic) => ['products', 'catalog'].includes(topic));
    if (publicTopics.length) emitRealtimeMany(publicTopics, 'catalog.updated', {}, { room: 'public' });
    const customerTopics = topics.filter((topic) => ['orders', 'products', 'catalog'].includes(topic));
    if (customerTopics.length) emitRealtimeMany(customerTopics, 'account-data.updated', {}, { room: 'authenticated' });
  });
  return next();
};
