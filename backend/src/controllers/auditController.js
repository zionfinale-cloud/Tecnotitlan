import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
  const where = {
    createdAt: { gte: new Date(Date.now() - days * 86400000) },
    ...(req.query.category ? { category: String(req.query.category) } : {}),
    ...(req.query.outcome ? { outcome: String(req.query.outcome) } : {}),
  };
  const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
  res.json({ status: 'success', data: { logs } });
});

export const listMySecurityActivity = asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { actorId: req.user.id, category: 'AUTH' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ status: 'success', data: { logs } });
});
