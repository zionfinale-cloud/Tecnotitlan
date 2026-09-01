import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';

const hasAny = (user, names) => names.some((name) => user.permissions?.includes(name));

export const getMyWork = asyncHandler(async (req, res) => {
  const canOrders = hasAny(req.user, ['order:read', 'order:update']);
  const canSupport = hasAny(req.user, ['support:read', 'support:update', 'whatsapp:chat']);
  const [orders, claims, whatsapp, questions, conversations, tickets] = await Promise.all([
    canOrders ? prisma.order.findMany({
      where: { status: { in: ['PROCESSING', 'PENDING_FULFILLMENT'] } },
      select: { id: true, orderNumber: true, status: true, salesChannel: true, totalPrice: true, createdAt: true, orderItems: { select: { name: true, qty: true } } },
      orderBy: { createdAt: 'asc' }, take: 20,
    }) : [],
    canSupport ? prisma.meliClaim.findMany({
      where: { status: 'opened' }, select: { id: true, externalClaimId: true, title: true, priority: true, dueDate: true, assignedTo: true, updatedAt: true, order: { select: { orderNumber: true } } },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }], take: 20,
    }) : [],
    canSupport ? prisma.whatsAppChat.aggregate({ _sum: { unreadCount: true } }) : null,
    canSupport ? prisma.meliQuestion.count({ where: { status: 'UNANSWERED' } }) : 0,
    canSupport ? prisma.meliPostSaleConversation.aggregate({ _sum: { unreadCount: true } }) : null,
    canSupport ? prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }) : 0,
  ]);
  const messages = {
    whatsapp: Number(whatsapp?._sum?.unreadCount || 0),
    questions: Number(questions || 0),
    postSale: Number(conversations?._sum?.unreadCount || 0),
    support: Number(tickets || 0),
  };
  res.json({
    status: 'success',
    data: {
      role: req.user.role?.name,
      generatedAt: new Date().toISOString(),
      summary: {
        pending: orders.length + claims.length + Object.values(messages).reduce((sum, value) => sum + value, 0),
        ordersToPrepare: orders.length,
        urgentClaims: claims.length,
        unreadMessages: Object.values(messages).reduce((sum, value) => sum + value, 0),
      },
      orders,
      claims,
      messages,
    },
  });
});
