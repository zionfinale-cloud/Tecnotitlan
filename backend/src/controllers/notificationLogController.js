import asyncHandler from 'express-async-handler';
import { listNotificationLogs } from '../services/notificationLogService.js';

export const getNotificationLogs = asyncHandler(async (req, res) => {
  const logs = await listNotificationLogs({
    limit: req.query.limit,
    channel: req.query.channel,
    status: req.query.status,
    orderNumber: req.query.orderNumber,
  });

  res.json({
    status: 'success',
    data: logs,
  });
});
