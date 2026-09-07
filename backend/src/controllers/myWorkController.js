import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { getMyWorkAccess } from '../utils/accessPolicies.js';

export const getMyWork = asyncHandler(async (req, res) => {
  const { canOrders, canSupport, canManageTeam } = getMyWorkAccess(req.user);
  const ownOrUnassigned = canManageTeam ? undefined : {
    OR: [{ assignedTo: null }, { assignedTo: { equals: req.user.email, mode: 'insensitive' } }],
  };
  const orderWhere = { status: { in: ['PROCESSING', 'PENDING_FULFILLMENT'] } };
  const claimWhere = { status: 'opened', ...(ownOrUnassigned || {}) };
  const ticketWhere = { status: { in: ['OPEN', 'IN_PROGRESS'] }, ...(ownOrUnassigned || {}) };
  const [orders, orderCount, claims, claimCount, whatsapp, questions, conversations, tickets] = await Promise.all([
    canOrders ? prisma.order.findMany({
      where: orderWhere,
      select: { id: true, orderNumber: true, status: true, salesChannel: true, totalPrice: true, createdAt: true, orderItems: { select: { name: true, qty: true } } },
      orderBy: { createdAt: 'asc' }, take: 20,
    }) : [],
    canOrders ? prisma.order.count({ where: orderWhere }) : 0,
    canSupport ? prisma.meliClaim.findMany({
      where: claimWhere, select: { id: true, externalClaimId: true, title: true, priority: true, dueDate: true, assignedTo: true, updatedAt: true, order: { select: { orderNumber: true } } },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }], take: 20,
    }) : [],
    canSupport ? prisma.meliClaim.count({ where: claimWhere }) : 0,
    canSupport ? prisma.whatsAppChat.aggregate({ _sum: { unreadCount: true } }) : null,
    canSupport ? prisma.meliQuestion.count({ where: { status: 'UNANSWERED' } }) : 0,
    canSupport ? prisma.meliPostSaleConversation.aggregate({ _sum: { unreadCount: true } }) : null,
    canSupport ? prisma.supportTicket.count({ where: ticketWhere }) : 0,
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
        pending: orderCount + claimCount + Object.values(messages).reduce((sum, value) => sum + value, 0),
        ordersToPrepare: orderCount,
        urgentClaims: claimCount,
        unreadMessages: Object.values(messages).reduce((sum, value) => sum + value, 0),
      },
      orders,
      claims,
      messages,
    },
  });
});
