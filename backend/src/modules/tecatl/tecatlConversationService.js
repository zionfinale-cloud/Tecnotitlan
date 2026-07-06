import prisma from '../../config/prisma.js';
import { classifyIntent } from './tecatlIntentService.js';
import { getRelevantKnowledge } from './tecatlKnowledgeService.js';
import { buildProductRecommendationText, searchProductsForMessage } from './tecatlProductAdvisorService.js';

const defaultProfile = {
  name: 'Tecatl',
  avatarUrl: '/images/logo2.png',
  welcomeMessage: 'Hola. Soy Tecatl, asesor de Tecnotitlan. Estoy aqui para ayudarte a elegir el producto correcto, revisar pedidos o resolver cualquier duda.',
  fallbackMessage: 'No quiero inventarte informacion. Te paso con un asesor humano para revisarlo bien.',
  isActive: true,
};

const getOrCreateProfile = async () => prisma.assistantProfile.upsert({
  where: { storeId: 'default' },
  update: {},
  create: {
    storeId: 'default',
    tone: 'amable, mexicano neutro, natural, breve, confiable',
    ...defaultProfile,
  },
});

const getConversation = async ({ conversationId, channel = 'WEB', customerId, externalUserId, customerName, customerEmail }) => {
  if (conversationId) {
    const existing = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
    if (existing) return existing;
  }

  if (externalUserId) {
    const existing = await prisma.chatConversation.findFirst({
      where: { externalUserId, channel, status: { not: 'CLOSED' } },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
  }

  return prisma.chatConversation.create({
    data: {
      storeId: 'default',
      channel,
      customerId: customerId || null,
      externalUserId: externalUserId || null,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      status: 'OPEN',
      lastMessageAt: new Date(),
    },
  });
};

const findOrderAnswer = async (message = '') => {
  const orderNumber = message.match(/TECNO-\d{6}/i)?.[0]?.toUpperCase();
  if (!orderNumber) {
    return 'Con gusto reviso tu pedido. Pasame tu numero de pedido, por ejemplo TECNO-000123, o el correo con el que compraste.';
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      isPaid: true,
      isDelivered: true,
      shippedAt: true,
      deliveredAt: true,
      shippingInfo: true,
    },
  });

  if (!order) {
    return `No encontre el pedido ${orderNumber}. Revisa si el numero esta completo o te paso con un asesor para buscarlo por correo.`;
  }

  const guide = order.shippingInfo?.trackingNumber || order.shippingInfo?.tracking || null;
  const guideText = guide ? ` Guia: ${guide}.` : ' La guia aparecera cuando el pedido sea enviado.';
  return `Tu pedido ${order.orderNumber} esta en estado ${order.status}.${order.isPaid ? ' Pago confirmado.' : ' Pago pendiente.'}${guideText}`;
};

const createHandoff = async (conversationId, reason) => {
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { status: 'HUMAN_REQUIRED' },
  });

  await prisma.conversationHandoff.create({
    data: {
      conversationId,
      reason,
      status: 'OPEN',
    },
  });
};

const buildTemplateReply = async ({ intent, message, profile, conversationId }) => {
  if (intent === 'saludo') return profile.welcomeMessage;

  if (['buscar_producto', 'recomendar_producto', 'comparar_productos'].includes(intent)) {
    const products = await searchProductsForMessage(message);
    return buildProductRecommendationText(products);
  }

  if (intent === 'recomendar_kit') {
    await createHandoff(conversationId, 'Solicitud de recomendacion de kit');
    return 'Me gusta esa idea. Para armarte un kit correcto prefiero que un asesor lo revise contigo segun uso y presupuesto. Ya deje registrada la solicitud.';
  }

  if (intent === 'consultar_pedido') return findOrderAnswer(message);

  if (intent === 'garantia_devolucion' || intent === 'envio_tiempo') {
    const articles = await getRelevantKnowledge(intent, message);
    if (articles.length) return articles.map((article) => article.content).join('\n\n');
  }

  if (intent === 'hablar_humano') {
    await createHandoff(conversationId, 'Cliente solicito asesor humano');
    return 'Claro, te paso con un asesor humano. Mientras tanto dejo registrada tu solicitud para que el equipo le de seguimiento.';
  }

  return profile.fallbackMessage;
};

const handleIncomingMessage = async ({
  message,
  conversationId,
  channel = 'WEB',
  customerId,
  externalUserId,
  customerName,
  customerEmail,
}) => {
  const content = String(message || '').trim();
  if (!content) throw new Error('El mensaje no puede estar vacio.');

  const profile = await getOrCreateProfile();
  const conversation = await getConversation({ conversationId, channel, customerId, externalUserId, customerName, customerEmail });
  const intent = classifyIntent(content);

  const userMessage = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content,
      metadata: { intent, channel },
    },
  });

  const reply = profile.isActive
    ? await buildTemplateReply({ intent, message: content, profile, conversationId: conversation.id })
    : profile.fallbackMessage;

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: reply,
      metadata: { intent, provider: 'template' },
    },
  });

  const updatedConversation = await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: {
      intent,
      lastMessageAt: new Date(),
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      handoffs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return {
    conversation: updatedConversation,
    userMessage,
    assistantMessage,
    reply,
    intent,
  };
};

const listConversations = async () => prisma.chatConversation.findMany({
  orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  include: {
    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    _count: { select: { messages: true, handoffs: true } },
  },
  take: 100,
});

const getConversationById = async (id) => prisma.chatConversation.findUnique({
  where: { id },
  include: {
    messages: { orderBy: { createdAt: 'asc' } },
    handoffs: { orderBy: { createdAt: 'desc' }, include: { assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } } } },
  },
});

export {
  getConversationById,
  getOrCreateProfile,
  handleIncomingMessage,
  listConversations,
};
