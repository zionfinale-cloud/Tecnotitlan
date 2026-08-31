import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errorUtils.js';
import * as whatsappService from '../services/whatsappService.js';
import * as mercadoLibreService from '../services/mercadoLibreService.js';
import { sendTransactionalMail } from '../services/emailService.js';
import { normalizeInboxValue, findAutomaticInboxOrder } from '../utils/unifiedInboxMatcher.js';
import { evaluateInboxSla } from '../utils/inboxSla.js';
import { getMeliClaimOutcome } from '../utils/meliClaimOutcome.js';
import { classifyInboxItem } from '../utils/unifiedInboxClassification.js';

const SOURCE_TYPES = new Set(['WHATSAPP', 'SUPPORT', 'MELI_QUESTION', 'MELI_POST_SALE', 'MELI_CLAIM', 'TECATL']);
const canReplyToSource = (user, sourceType) => {
  if (user?.role?.name === 'SUPER_ADMIN') return true;
  const permissions = new Set((user?.role?.permissions || []).map((permission) => permission.name));
  if (sourceType === 'WHATSAPP') return permissions.has('whatsapp:chat') || permissions.has('support:update');
  if (sourceType === 'TECATL') return permissions.has('tecatl:reply');
  return permissions.has('support:update');
};
const normalize = normalizeInboxValue;
const messageText = (value) => typeof value === 'string' ? value : value?.plain || value?.message || '';
const asDate = (value) => value ? new Date(value) : null;

const orderSummary = (order) => order ? ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  isPaid: order.isPaid,
  salesChannel: order.salesChannel,
  totalPrice: order.totalPrice,
  createdAt: order.createdAt,
  customer: order.user ? {
    id: order.user.id,
    name: [order.user.firstName, order.user.lastName].filter(Boolean).join(' '),
    email: order.user.email,
    phone: order.user.phone,
  } : null,
  items: (order.orderItems || []).map((item) => ({
    id: item.id, name: item.name, qty: item.qty, sku: item.product?.sku, productId: item.productId,
  })),
  externalOrders: (order.externalOrders || []).map((entry) => ({ channel: entry.channel, externalOrderId: entry.externalOrderId })),
}) : null;

const findAutomaticOrder = findAutomaticInboxOrder;

const buildLink = (sourceType, sourceId, explicitLinks, automatic, nativeOrder) => {
  const explicit = explicitLinks.get(`${sourceType}:${sourceId}`);
  if (explicit) return { order: explicit.order, method: explicit.linkMethod, confidence: explicit.confidence, confirmed: true };
  if (nativeOrder) return { order: nativeOrder, method: 'NATIVE_CHANNEL', confidence: 100, confirmed: true };
  if (automatic) return { ...automatic, confirmed: false };
  return null;
};

const attachOrder = (item, link) => ({
  ...item,
  linkedOrder: orderSummary(link?.order),
  orderLink: link ? { method: link.method, confidence: link.confidence, confirmed: link.confirmed } : null,
});

const loadInboxData = async () => {
  const [orders, links, replies, whatsapp, tickets, questions, postSale, claims, tecatl] = await Promise.all([
    prisma.order.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
        externalOrders: true,
      },
      orderBy: { createdAt: 'desc' }, take: 300,
    }),
    prisma.unifiedInboxLink.findMany({ include: { order: { include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
      externalOrders: true,
    } } } }),
    prisma.unifiedInboxReply.findMany({ orderBy: { createdAt: 'asc' }, take: 500 }),
    prisma.whatsAppChat.findMany({ include: { messages: { orderBy: { createdAt: 'desc' }, take: 300 } }, orderBy: { lastMessageAt: 'desc' }, take: 100 }),
    prisma.supportTicket.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.meliQuestion.findMany({ include: { product: { select: { id: true, sku: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.meliPostSaleConversation.findMany({ include: { order: { include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } }, externalOrders: true,
    } }, messages: { orderBy: { sentAt: 'asc' } } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.meliClaim.findMany({ include: { order: { include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } }, externalOrders: true,
    } } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.chatConversation.findMany({
      include: { customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 300 }, handoffs: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 100,
    }),
  ]);
  return {
    orders,
    explicitLinks: new Map(links.map((link) => [`${link.sourceType}:${link.sourceId}`, link])),
    repliesBySource: replies.reduce((map, reply) => {
      const key = `${reply.sourceType}:${reply.sourceId}`;
      map.set(key, [...(map.get(key) || []), reply]);
      return map;
    }, new Map()),
    whatsapp, tickets, questions, postSale, claims, tecatl,
  };
};

const buildInboxItems = ({ orders, explicitLinks, repliesBySource, whatsapp, tickets, questions, postSale, claims, tecatl }) => {
  const items = [];
  whatsapp.forEach((chat) => {
    const automatic = findAutomaticOrder({ orders, phone: chat.phone });
    const messages = [...chat.messages].reverse().map((entry) => ({ id: entry.id, direction: entry.fromMe ? 'OUTBOUND' : 'INBOUND', text: entry.text, at: entry.createdAt, status: entry.status, mediaUrl: entry.mediaUrl }));
    items.push(attachOrder({
      id: `WHATSAPP:${chat.jid}`, sourceType: 'WHATSAPP', sourceId: chat.jid, channel: 'WhatsApp', kind: 'Chat',
      title: chat.name || chat.phone || 'Contacto WhatsApp', customer: { name: chat.name, phone: chat.phone }, preview: chat.lastMessage || messages.at(-1)?.text || '',
      unreadCount: chat.unreadCount, status: chat.unreadCount ? 'PENDING' : 'OPEN', priority: chat.unreadCount ? 'HIGH' : 'NORMAL', timestamp: chat.lastMessageAt || chat.updatedAt,
      messages, deepLink: '/admin/whatsapp-chat', canReply: true,
    }, buildLink('WHATSAPP', chat.jid, explicitLinks, automatic)));
  });
  tickets.forEach((ticket) => {
    const automatic = findAutomaticOrder({ orders, userId: ticket.userId, email: ticket.email, phone: ticket.phone });
    const messages = [{ id: `${ticket.id}:request`, direction: 'INBOUND', text: ticket.message, at: ticket.createdAt }];
    const storedReplies = repliesBySource.get(`SUPPORT:${ticket.id}`) || [];
    if (storedReplies.length) storedReplies.forEach((reply) => messages.push({ id: reply.id, direction: 'OUTBOUND', text: reply.text, at: reply.createdAt, status: reply.deliveryStatus }));
    else if (ticket.resolution) messages.push({ id: `${ticket.id}:resolution`, direction: 'OUTBOUND', text: ticket.resolution, at: ticket.updatedAt });
    items.push(attachOrder({
      id: `SUPPORT:${ticket.id}`, sourceType: 'SUPPORT', sourceId: ticket.id, channel: ticket.source === 'EMAIL' ? 'Correo' : 'Soporte', kind: ticket.ticketNumber,
      title: ticket.subject, customer: { name: ticket.name, email: ticket.email, phone: ticket.phone }, preview: ticket.message,
      unreadCount: ['OPEN', 'IN_PROGRESS'].includes(ticket.status) ? 1 : 0, status: ticket.status, priority: ticket.priority, timestamp: ticket.updatedAt,
      messages, deepLink: '/admin/support', canReply: !['RESOLVED', 'CLOSED'].includes(ticket.status),
    }, buildLink('SUPPORT', ticket.id, explicitLinks, automatic)));
  });
  questions.forEach((question) => {
    const messages = [{ id: `${question.id}:question`, direction: 'INBOUND', text: question.text, at: question.askedAt }];
    if (question.answerText) messages.push({ id: `${question.id}:answer`, direction: 'OUTBOUND', text: question.answerText, at: question.answeredAt });
    items.push(attachOrder({
      id: `MELI_QUESTION:${question.externalQuestionId}`, sourceType: 'MELI_QUESTION', sourceId: question.externalQuestionId, channel: 'Mercado Libre', kind: 'Pregunta preventa',
      title: question.product?.name || question.itemId, customer: { externalId: question.buyerId }, preview: question.text,
      unreadCount: question.status === 'UNANSWERED' ? 1 : 0, status: question.status, priority: question.status === 'UNANSWERED' ? 'HIGH' : 'NORMAL', timestamp: question.askedAt || question.updatedAt,
      messages, product: question.product, deepLink: '/admin/meli-communications', canReply: question.status === 'UNANSWERED',
    }, buildLink('MELI_QUESTION', question.externalQuestionId, explicitLinks, null)));
  });
  postSale.forEach((conversation) => {
    items.push(attachOrder({
      id: `MELI_POST_SALE:${conversation.packId}`, sourceType: 'MELI_POST_SALE', sourceId: conversation.packId, channel: 'Mercado Libre', kind: 'Mensaje posventa',
      title: conversation.order?.orderNumber || `Paquete ${conversation.packId}`, customer: { externalId: conversation.buyerId }, preview: conversation.messages.at(-1)?.text || '',
      unreadCount: conversation.unreadCount, status: conversation.status || conversation.internalStatus, priority: conversation.unreadCount ? 'HIGH' : 'NORMAL', timestamp: conversation.lastMessageAt || conversation.updatedAt,
      messages: conversation.messages.map((entry) => ({ id: entry.id, direction: entry.direction, text: entry.text, at: entry.sentAt, status: entry.status })),
      deepLink: '/admin/meli-communications', canReply: conversation.status === 'active' && conversation.messages.length > 0, maxLength: conversation.maxMessageLength,
    }, buildLink('MELI_POST_SALE', conversation.packId, explicitLinks, null, conversation.order)));
  });
  claims.forEach((claim) => {
    const claimMessages = Array.isArray(claim.messagesData) ? claim.messagesData : claim.messagesData?.messages || [];
    const outcome = getMeliClaimOutcome(claim);
    const messages = claimMessages.map((entry, index) => ({ id: entry.id || `${claim.id}:${index}`, direction: entry.sender_role === 'respondent' ? 'OUTBOUND' : 'INBOUND', text: messageText(entry.message || entry.text), at: entry.date_created || entry.date }));
    if (outcome) messages.push({ id: `${claim.id}:outcome`, direction: 'SYSTEM', text: outcome.summary, at: outcome.at, status: 'RESOLUCIÓN' });
    messages.sort((left, right) => new Date(left.at || 0) - new Date(right.at || 0));
    items.push(attachOrder({
      id: `MELI_CLAIM:${claim.externalClaimId}`, sourceType: 'MELI_CLAIM', sourceId: claim.externalClaimId, channel: 'Mercado Libre', kind: 'Reclamo',
      title: claim.title || claim.problem || `Reclamo ${claim.externalClaimId}`, customer: {}, preview: outcome?.summary || claim.description || claim.problem || '', unreadCount: claim.status === 'opened' ? 1 : 0,
      status: claim.status, priority: claim.priority, timestamp: claim.updatedAt,
      messages, deepLink: '/admin/meli-claims', canReply: claim.status === 'opened', claimStage: claim.stage, outcome,
      returnId: claim.returnId, returnStatus: claim.returnStatus, returnShipmentId: claim.returnShipmentId,
    }, buildLink('MELI_CLAIM', claim.externalClaimId, explicitLinks, null, claim.order)));
  });
  const claimOrderIds = new Set(claims.map((claim) => claim.orderId).filter(Boolean));
  orders.filter((order) => (
    order.salesChannel === 'MERCADOLIBRE'
    && order.status === 'CANCELLED'
    && !claimOrderIds.has(order.id)
  )).forEach((order) => {
    const cancelledAt = order.updatedAt || order.createdAt;
    items.push(attachOrder({
      id: `ORDER_CANCELLATION:${order.id}`, sourceType: 'ORDER_CANCELLATION', sourceId: order.id,
      channel: 'Mercado Libre', kind: 'Cancelación', title: `Cancelación ${order.orderNumber}`,
      customer: orderSummary(order)?.customer || {},
      preview: `El pedido ${order.orderNumber} fue cancelado en Mercado Libre. Revisa el pago, inventario y motivo de cancelación.`,
      unreadCount: 0, status: 'CANCELLED', priority: 'URGENT', timestamp: cancelledAt,
      messages: [{ id: `${order.id}:cancelled`, direction: 'SYSTEM', text: `Mercado Libre reportó la cancelación del pedido ${order.orderNumber}. Verifica el reembolso y la restitución del inventario.`, at: cancelledAt, status: 'CANCELADO' }],
      deepLink: '/admin/orderlist', canReply: false, linkable: false,
    }, { order, method: 'NATIVE_CHANNEL', confidence: 100, confirmed: true }));
  });
  tecatl.forEach((conversation) => {
    const automatic = findAutomaticOrder({ orders, userId: conversation.customerId, email: conversation.customerEmail, phone: conversation.customer?.phone });
    const openHandoff = conversation.handoffs?.[0] && ['OPEN', 'ASSIGNED'].includes(conversation.handoffs[0].status);
    items.push(attachOrder({
      id: `TECATL:${conversation.id}`, sourceType: 'TECATL', sourceId: conversation.id, channel: conversation.channel === 'WHATSAPP' ? 'Tecatl WhatsApp' : 'Tecatl Web', kind: 'Asistente',
      title: conversation.customerName || [conversation.customer?.firstName, conversation.customer?.lastName].filter(Boolean).join(' ') || 'Conversación Tecatl',
      customer: { name: conversation.customerName, email: conversation.customerEmail }, preview: conversation.messages.at(-1)?.content || '',
      unreadCount: openHandoff ? 1 : 0, status: conversation.status, priority: openHandoff ? 'HIGH' : 'NORMAL', timestamp: conversation.lastMessageAt || conversation.updatedAt,
      messages: [...conversation.messages].reverse().map((entry) => ({ id: entry.id, direction: entry.role === 'USER' ? 'INBOUND' : 'OUTBOUND', text: entry.content, at: entry.createdAt })),
      deepLink: '/admin/tecatl', canReply: openHandoff,
    }, buildLink('TECATL', conversation.id, explicitLinks, automatic)));
  });
  return items.map((item) => {
    const classified = { ...item, ...classifyInboxItem(item) };
    return { ...classified, sla: evaluateInboxSla(classified) };
  }).sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
};

const getInboxItemsSnapshot = async () => buildInboxItems(await loadInboxData());

const getUnifiedInbox = asyncHandler(async (req, res) => {
  const data = await loadInboxData();
  let items = buildInboxItems(data);
  const query = normalize(req.query.q);
  const channel = normalize(req.query.channel);
  const section = String(req.query.section || '').toUpperCase();
  const type = String(req.query.type || '').toUpperCase();
  const pending = String(req.query.pending || '') === 'true';
  if (query) items = items.filter((item) => normalize([
    item.title, item.preview, item.sourceId, item.customer?.name, item.customer?.email, item.customer?.phone,
    item.linkedOrder?.orderNumber, ...(item.linkedOrder?.items || []).flatMap((entry) => [entry.name, entry.sku]),
  ].join(' ')).includes(query));
  if (channel) items = items.filter((item) => normalize(item.channel).includes(channel));
  if (section) items = items.filter((item) => item.section === section);
  if (type) items = items.filter((item) => item.type === type);
  if (pending) items = items.filter((item) => item.unreadCount > 0 || ['OPEN', 'UNANSWERED', 'opened', 'HUMAN_REQUIRED'].includes(item.status));
  const counts = {
    total: items.length,
    pending: items.filter((item) => item.unreadCount > 0).length,
    unlinked: items.filter((item) => !item.linkedOrder).length,
    channels: items.reduce((result, item) => ({ ...result, [item.channel]: (result[item.channel] || 0) + 1 }), {}),
    sections: items.reduce((result, item) => ({ ...result, [item.section]: (result[item.section] || 0) + 1 }), {}),
    types: items.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {}),
  };
  res.json({ status: 'success', data: { items, counts } });
});

const getUnifiedInboxCounts = asyncHandler(async (req, res) => {
  const [whatsapp, tickets, questions, postSale, claims, handoffs] = await Promise.all([
    prisma.whatsAppChat.aggregate({ _sum: { unreadCount: true } }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.meliQuestion.count({ where: { status: 'UNANSWERED' } }),
    prisma.meliPostSaleConversation.aggregate({ _sum: { unreadCount: true } }),
    prisma.meliClaim.count({ where: { status: 'opened' } }),
    prisma.conversationHandoff.count({ where: { status: { in: ['OPEN', 'ASSIGNED'] } } }),
  ]);
  const byChannel = {
    whatsapp: Number(whatsapp._sum.unreadCount || 0), support: tickets, questions,
    postSale: Number(postSale._sum.unreadCount || 0), claims, tecatl: handoffs,
  };
  res.json({ status: 'success', data: { ...byChannel, total: Object.values(byChannel).reduce((sum, value) => sum + value, 0) } });
});

const searchInboxOrders = asyncHandler(async (req, res) => {
  const query = normalize(req.query.q);
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
      externalOrders: true,
    },
    orderBy: { createdAt: 'desc' }, take: 150,
  });
  const matches = orders.filter((order) => !query || normalize([
    order.orderNumber, order.user?.firstName, order.user?.lastName, order.user?.email, order.user?.phone,
    ...order.orderItems.flatMap((item) => [item.name, item.product?.sku]),
    ...order.externalOrders.map((entry) => entry.externalOrderId),
  ].join(' ')).includes(query)).slice(0, 30).map(orderSummary);
  res.json({ status: 'success', data: { orders: matches } });
});

const linkInboxOrder = asyncHandler(async (req, res) => {
  const { sourceType, sourceId } = req.params;
  if (!SOURCE_TYPES.has(sourceType)) throw new BadRequestError('Origen de bandeja invalido.');
  const order = await prisma.order.findUnique({ where: { id: req.body.orderId }, select: { id: true } });
  if (!order) throw new NotFoundError('Pedido no encontrado.');
  const link = await prisma.unifiedInboxLink.upsert({
    where: { sourceType_sourceId: { sourceType, sourceId } },
    update: { orderId: order.id, linkMethod: 'MANUAL', confidence: 100, linkedById: req.user.id, linkedBy: req.user.email },
    create: { sourceType, sourceId, orderId: order.id, linkMethod: 'MANUAL', confidence: 100, linkedById: req.user.id, linkedBy: req.user.email },
  });
  res.json({ status: 'success', message: 'Conversación vinculada al pedido.', data: { link } });
});

const unlinkInboxOrder = asyncHandler(async (req, res) => {
  const { sourceType, sourceId } = req.params;
  await prisma.unifiedInboxLink.deleteMany({ where: { sourceType, sourceId } });
  res.json({ status: 'success', message: 'Vínculo manual eliminado.' });
});

const replyUnifiedInbox = asyncHandler(async (req, res) => {
  const { sourceType, sourceId } = req.params;
  const text = String(req.body.text || '').trim();
  if (!SOURCE_TYPES.has(sourceType)) throw new BadRequestError('Origen de bandeja invalido.');
  if (!canReplyToSource(req.user, sourceType)) throw new ForbiddenError('No tienes permiso para responder este canal.');
  if (!text) throw new BadRequestError('La respuesta no puede estar vacia.');
  if (text.length > 5000) throw new BadRequestError('La respuesta es demasiado larga.');
  let result;
  if (sourceType === 'WHATSAPP') {
    result = await whatsappService.sendMessage(sourceId, text, req.user.email);
  } else if (sourceType === 'MELI_QUESTION') {
    result = await mercadoLibreService.answerMeliQuestion(req.user.id, sourceId, text);
  } else if (sourceType === 'MELI_POST_SALE') {
    result = await mercadoLibreService.sendMeliPostSaleMessage(req.user.id, sourceId, text);
  } else if (sourceType === 'MELI_CLAIM') {
    const claim = await prisma.meliClaim.findUnique({ where: { externalClaimId: sourceId } });
    if (!claim) throw new NotFoundError('Reclamo no encontrado.');
    result = await mercadoLibreService.sendMeliClaimMessage(req.user.id, sourceId, {
      message: text.slice(0, 3500), receiverRole: claim.stage === 'dispute' ? 'mediator' : 'complainant',
    });
  } else if (sourceType === 'SUPPORT') {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: sourceId } });
    if (!ticket) throw new NotFoundError('Ticket no encontrado.');
    await sendTransactionalMail({
      to: ticket.email,
      subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
      text: `${text}\n\n— Equipo Tecnotitlan\nReferencia: ${ticket.ticketNumber}`,
    });
    result = await prisma.supportTicket.update({
      where: { id: ticket.id }, data: { status: 'WAITING_CUSTOMER', resolution: text, assignedTo: req.user.email },
    });
  } else if (sourceType === 'TECATL') {
    const conversation = await prisma.chatConversation.findUnique({ where: { id: sourceId } });
    if (!conversation) throw new NotFoundError('Conversacion no encontrada.');
    let delivery = null;
    if (conversation.channel === 'WHATSAPP') {
      if (!conversation.externalUserId) throw new BadRequestError('La conversacion no tiene destino de WhatsApp.');
      delivery = await whatsappService.sendMessage(conversation.externalUserId, text, req.user.email);
    }
    result = await prisma.$transaction(async (tx) => {
      await tx.chatMessage.create({ data: { conversationId: sourceId, role: 'HUMAN', content: text, metadata: { sentBy: req.user.email, delivery } } });
      await tx.conversationHandoff.updateMany({ where: { conversationId: sourceId, status: 'OPEN' }, data: { status: 'ASSIGNED', assignedTo: req.user.id } });
      return tx.chatConversation.update({ where: { id: sourceId }, data: { status: 'OPEN', lastMessageAt: new Date() } });
    });
  }
  await prisma.unifiedInboxReply.create({
    data: { sourceType, sourceId, text, actorId: req.user.id, actorName: req.user.email, metadata: { channelAccepted: true } },
  }).catch(() => {});
  res.status(201).json({ status: 'success', message: 'Respuesta enviada desde la bandeja unificada.', data: { result } });
});

export { getUnifiedInbox, getUnifiedInboxCounts, searchInboxOrders, linkInboxOrder, unlinkInboxOrder, replyUnifiedInbox, getInboxItemsSnapshot };
