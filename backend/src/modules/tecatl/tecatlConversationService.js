import prisma from '../../config/prisma.js';
import { classifyIntent, normalizeText } from './tecatlIntentService.js';
import { getRelevantKnowledge } from './tecatlKnowledgeService.js';
import {
  buildProductDetailAnswer,
  buildProductRecommendationText,
  findProductsBySkus,
  searchProductsForMessage,
} from './tecatlProductAdvisorService.js';

const defaultProfile = {
  name: 'Tecatl',
  avatarUrl: '/images/tecatl-bot.png',
  welcomeMessage: 'Hola, soy Tecatl, el asistente de Tecnotitlan. Te ayudo a elegir productos, revisar pedidos, formas de pago, envios o garantias. Si algo requiere ojo humano, se lo paso al equipo.',
  fallbackMessage: 'No quiero inventarte informacion. Ya deje esta conversacion lista para que un asesor humano la revise y te responda bien.',
  isActive: true,
};

const BUSINESS_TIMEZONE = 'America/Mexico_City';
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 19;

const getMexicoHour = () => {
  const hourText = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  return Number(hourText);
};

const isWithinBusinessHours = () => {
  const hour = getMexicoHour();
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
};

const buildHandoffReply = (message) => {
  if (isWithinBusinessHours()) {
    return `${message} Un asesor de Tecnotitlan lo revisa en breve para darte seguimiento humano.`;
  }

  return `${message} Nuestro equipo atiende hasta las 7:00 p.m.; ya quedo registrado para que un vendedor lo revise a primera hora. En Tecnotitlan no dejamos al cliente solo.`;
};

const getTokens = (message = '') => normalizeText(message)
  .replace(/[^a-z0-9\s-]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

const includesPhrase = (normalizedMessage, phrases = []) => phrases
  .some((phrase) => normalizedMessage.includes(normalizeText(phrase)));

const includesToken = (tokens = [], values = []) => values
  .some((value) => tokens.includes(normalizeText(value)));

const buildConversationReply = ({ message, profile }) => {
  const normalized = normalizeText(message);
  const tokens = getTokens(message);
  const wordCount = tokens.length;

  if (includesPhrase(normalized, ['como estas', 'que tal estas', 'como andas', 'todo bien'])) {
    return 'Estoy listo para ayudarte. Puedo orientarte con productos, stock, envios, pagos o seguimiento de tu pedido.';
  }

  if (includesPhrase(normalized, ['quien eres', 'eres bot', 'eres humano', 'que eres', 'tecatl'])) {
    return 'Soy Tecatl, el asistente de Tecnotitlan. Te ayudo con dudas rapidas y, si algo necesita revision humana, lo paso al equipo.';
  }

  if (includesPhrase(normalized, ['gracias', 'muchas gracias', 'te agradezco'])
    || (wordCount <= 4 && includesToken(tokens, ['ok', 'va', 'sale', 'listo', 'perfecto', 'bien', 'excelente']))) {
    return 'Con gusto. Aqui sigo si necesitas revisar algun producto, pedido, envio o forma de pago.';
  }

  if (includesPhrase(normalized, ['me ayudas', 'puedes ayudar', 'tengo duda', 'necesito ayuda', 'informes'])
    || (wordCount <= 3 && includesToken(tokens, ['ayuda', 'info', 'informacion']))) {
    return 'Claro. Dime que necesitas revisar: producto, pedido, envio, garantia, forma de pago o compatibilidad.';
  }

  if (includesPhrase(normalized, ['quiero comprar', 'me interesa', 'ando buscando', 'busco algo'])
    || (wordCount <= 4 && includesToken(tokens, ['comprar', 'cotizar', 'recomendar']))) {
    return 'Va. Dime para que lo necesitas, tu presupuesto aproximado y si buscas alguna compatibilidad especial. Con eso te recomiendo opciones reales del catalogo.';
  }

  if (includesPhrase(normalized, ['mi pedido', 'seguimiento', 'rastreo', 'guia', 'mi paquete'])
    && !/TECNO-\d{6}/i.test(message)) {
    return 'Con gusto reviso tu pedido. Pasame tu folio, por ejemplo TECNO-000123, o el correo con el que hiciste la compra.';
  }

  if (wordCount <= 2 && includesToken(tokens, ['si', 'no', 'dale', 'ok', 'va'])) {
    return 'Va, te sigo. Cuentame un poquito mas para ayudarte bien.';
  }

  if (intentLooksLikeGreeting(normalized)) return profile.welcomeMessage;

  return null;
};

const intentLooksLikeGreeting = (normalizedMessage = '') => includesPhrase(normalizedMessage, [
  'hola',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'que tal',
  'saludos',
  'hey',
]);

const buildExistingHandoffReply = (message = '') => {
  const normalized = normalizeText(message);
  const tokens = getTokens(message);

  if (includesPhrase(normalized, ['gracias', 'muchas gracias'])
    || includesToken(tokens, ['ok', 'va', 'sale', 'listo', 'perfecto'])) {
    return buildHandoffReply('Con gusto. La conversacion ya esta en seguimiento humano.');
  }

  return buildHandoffReply('Gracias, ya agregue tu mensaje al seguimiento abierto.');
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
    if (existing) {
      if (customerId || externalUserId || customerName || customerEmail) {
        const shouldReplaceExternalUser = externalUserId && (
          !existing.externalUserId || existing.externalUserId.startsWith('guest:')
        );

        return prisma.chatConversation.update({
          where: { id: existing.id },
          data: {
            customerId: existing.customerId || customerId || null,
            externalUserId: shouldReplaceExternalUser ? externalUserId : existing.externalUserId,
            customerName: customerName || existing.customerName,
            customerEmail: customerEmail || existing.customerEmail,
          },
        });
      }
      return existing;
    }
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

  const existingHandoff = await prisma.conversationHandoff.findFirst({
    where: {
      conversationId,
      status: { in: ['OPEN', 'ASSIGNED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingHandoff) {
    return {
      handoff: existingHandoff,
      created: false,
      reason: existingHandoff.reason,
    };
  }

  const handoff = await prisma.conversationHandoff.create({
    data: {
      conversationId,
      reason,
      status: 'OPEN',
    },
  });

  return {
    handoff,
    created: true,
    reason,
  };
};

const getActiveHandoff = async (conversationId) => prisma.conversationHandoff.findFirst({
  where: {
    conversationId,
    status: { in: ['OPEN', 'ASSIGNED'] },
  },
  orderBy: { createdAt: 'desc' },
});

const extractSkusFromText = (text = '') => [...text.matchAll(/\b[A-Z]{2,5}-\d{3,}\b/gi)]
  .map((match) => match[0].toUpperCase());

const findRecentProductContext = async (conversationId) => {
  const recentMessages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { content: true, role: true },
  });

  const skus = recentMessages.flatMap((message) => extractSkusFromText(message.content));
  return findProductsBySkus(skus);
};

const answerProductFollowUp = async ({ message, conversationId }) => {
  const directMatches = await searchProductsForMessage(message, 1);
  const directAnswer = buildProductDetailAnswer(message, directMatches[0]);
  if (directAnswer) return directAnswer;

  const contextProducts = await findRecentProductContext(conversationId);
  const contextAnswer = buildProductDetailAnswer(message, contextProducts[0]);
  if (contextAnswer) return contextAnswer;

  return null;
};

const buildTemplateReply = async ({ intent, message, profile, conversationId, handoffRef }) => {
  const requestHandoff = async (reason) => {
    const handoffInfo = await createHandoff(conversationId, reason);
    handoffRef.current = handoffInfo;
    return handoffInfo;
  };

  const earlyConversationReply = ['saludo', 'pregunta_general'].includes(intent)
    ? buildConversationReply({ message, profile })
    : null;
  if (earlyConversationReply) return earlyConversationReply;

  if (intent === 'saludo') return profile.welcomeMessage;

  if (intent === 'mayoreo') {
    await requestHandoff('Cliente pregunto por mayoreo');
    return buildHandoffReply('Si buscas precio por mayoreo, dime producto, cantidad aproximada y ciudad de envio.');
  }

  if (['buscar_producto', 'recomendar_producto', 'comparar_productos'].includes(intent)) {
    const products = await searchProductsForMessage(message);
    const productAnswer = buildProductDetailAnswer(message, products[0]);
    if (productAnswer) return productAnswer;
    return buildProductRecommendationText(products);
  }

  if (intent === 'recomendar_kit') {
    await requestHandoff('Solicitud de recomendacion de kit');
    return buildHandoffReply('Me gusta esa idea. Para armarte un kit correcto prefiero que un asesor lo revise contigo segun uso y presupuesto.');
  }

  if (intent === 'consultar_pedido') return findOrderAnswer(message);

  if (['garantia_devolucion', 'envio_tiempo', 'metodo_pago', 'informacion_tienda', 'facturacion'].includes(intent)) {
    const articles = await getRelevantKnowledge(intent, message);
    if (articles.length) return articles.map((article) => article.content).join('\n\n');

    // Respuestas locales por defecto si no existen artículos en la base de datos
    if (intent === 'metodo_pago') {
      return 'Puedes pagar con tarjeta de credito o debito, transferencia SPEI, Mercado Libre o WhatsApp si necesitas coordinar algo especial. Tecnotitlan no guarda datos de tarjeta.';
    }
    if (intent === 'informacion_tienda') {
      return 'Somos una tienda 100% online, lo que nos permite ofrecerte mejores precios y envios rapidos y seguros a todo Mexico. No contamos con sucursal fisica para compras en persona.';
    }
    if (intent === 'facturacion') {
      return '¡Claro que si! Facturamos todas tus compras. Una vez completado tu pedido, envianos tus datos fiscales (RFC, Razon Social, Regimen y Uso de CFDI) junto con tu correo y te la haremos llegar.';
    }
  }

  if (intent === 'hablar_humano') {
    await requestHandoff('Cliente solicito asesor humano');
    return buildHandoffReply('Claro, te paso con un asesor humano.');
  }

  const productFollowUp = await answerProductFollowUp({ message, conversationId });
  if (productFollowUp) return productFollowUp;

  const conversationReply = buildConversationReply({ message, profile });
  if (conversationReply) return conversationReply;

  await requestHandoff('Tecatl no encontro respuesta confiable');
  return buildHandoffReply(profile.fallbackMessage);
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
  const handoffRef = { current: null };

  const userMessage = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content,
      metadata: { intent, channel },
    },
  });

  const activeHandoff = conversation.status === 'HUMAN_REQUIRED'
    ? await getActiveHandoff(conversation.id)
    : null;

  if (activeHandoff) {
    const reply = buildExistingHandoffReply(content);
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: reply,
        metadata: { intent: 'seguimiento_humano', provider: 'template' },
      },
    });

    const updatedConversation = await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        intent: 'seguimiento_humano',
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
      intent: 'seguimiento_humano',
      handoff: {
        handoff: activeHandoff,
        created: false,
        reason: activeHandoff.reason,
      },
    };
  }

  const reply = profile.isActive
    ? await buildTemplateReply({
      intent,
      message: content,
      profile,
      conversationId: conversation.id,
      handoffRef,
    })
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
    handoff: handoffRef.current,
  };
};

const listConversations = async () => prisma.chatConversation.findMany({
  orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  include: {
    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    handoffs: { orderBy: { createdAt: 'desc' }, take: 1 },
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
