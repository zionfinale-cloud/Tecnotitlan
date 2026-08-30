import crypto from 'crypto';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

const hashIp = (ip) => {
  if (!ip) return null;
  const key = process.env.AUDIT_HASH_KEY || process.env.JWT_SECRET || 'tecnotitlan-audit';
  return crypto.createHmac('sha256', key).update(String(ip)).digest('hex').slice(0, 24);
};

export const writeAuditLog = async ({ req, action, category = 'GENERAL', entityType, entityId, outcome, statusCode, metadata } = {}) => {
  try {
    const actor = req?.user || req?.auditActor || null;
    return await prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorEmail: actor?.email || req?.auditActorEmail || null,
        action: action || `${req?.method || 'UNKNOWN'} ${req?.baseUrl || ''}${req?.route?.path || req?.path || ''}`,
        category,
        entityType: entityType || null,
        entityId: entityId ? String(entityId) : null,
        outcome: outcome || ((statusCode || 200) < 400 ? 'SUCCESS' : 'FAILURE'),
        method: req?.method || null,
        path: req?.originalUrl?.split('?')[0] || null,
        statusCode: statusCode || null,
        ipHash: hashIp(req?.ip),
        userAgent: String(req?.get?.('user-agent') || '').slice(0, 500) || null,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    logger.error('[Audit] No se pudo guardar el evento:', error.message);
    return null;
  }
};
