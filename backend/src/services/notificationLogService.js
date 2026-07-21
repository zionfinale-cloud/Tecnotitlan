import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

const MAX_TEXT_LENGTH = 1200;

const trimText = (value) => {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}...` : text;
};

const normalizeOrder = (order = {}) => ({
  orderId: order?.id || null,
  orderNumber: order?.orderNumber || null,
});

export const writeNotificationLog = async ({
  channel = 'SYSTEM',
  audience = 'SYSTEM',
  event = 'unknown',
  status = 'PENDING',
  provider = null,
  recipient = null,
  order = null,
  orderId = null,
  orderNumber = null,
  message = null,
  error = null,
  details = null,
} = {}) => {
  try {
    const orderInfo = order ? normalizeOrder(order) : {};
    await prisma.notificationLog.create({
      data: {
        channel,
        audience,
        event,
        status,
        provider,
        recipient: trimText(recipient),
        orderId: orderId || orderInfo.orderId || null,
        orderNumber: orderNumber || orderInfo.orderNumber || null,
        message: trimText(message),
        error: trimText(error),
        details: details || undefined,
      },
    });
  } catch (logError) {
    logger.warn(`[NotificationLog] No se pudo guardar bitacora ${event}: ${logError.message}`);
  }
};

export const listNotificationLogs = async ({
  limit = 80,
  channel,
  status,
  orderNumber,
} = {}) => {
  const take = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const where = {
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(orderNumber ? { orderNumber: { contains: orderNumber, mode: 'insensitive' } } : {}),
  };

  return prisma.notificationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
};
