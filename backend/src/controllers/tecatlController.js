import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';
import {
  getConversationById,
  getOrCreateProfile,
  handleIncomingMessage,
  listConversations,
} from '../modules/tecatl/tecatlConversationService.js';
import { sendMessage as sendWhatsAppMessage } from '../services/whatsappService.js';

const normalizeTags = (tags) => (Array.isArray(tags) ? tags : String(tags || '').split(','))
  .map((tag) => String(tag).trim().toLowerCase())
  .filter(Boolean);

const sendPublicMessage = asyncHandler(async (req, res, next) => {
  const { message, conversationId, customerName, customerEmail, externalUserId } = req.body;
  if (!message?.trim()) return next(new BadRequestError('Escribe un mensaje para Tecatl.'));

  const result = await handleIncomingMessage({
    message,
    conversationId,
    channel: 'WEB',
    customerId: req.user?.id,
    externalUserId,
    customerName,
    customerEmail,
  });

  res.status(201).json({
    status: 'success',
    data: {
      conversationId: result.conversation.id,
      reply: result.reply,
      intent: result.intent,
      messages: result.conversation.messages,
      status: result.conversation.status,
    },
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const profile = await getOrCreateProfile();
  res.json({ status: 'success', data: { profile } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatarUrl, tone, welcomeMessage, fallbackMessage, isActive } = req.body;
  const profile = await getOrCreateProfile();

  const updatedProfile = await prisma.assistantProfile.update({
    where: { id: profile.id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() || profile.name } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl?.trim() || null } : {}),
      ...(tone !== undefined ? { tone: String(tone).trim() || profile.tone } : {}),
      ...(welcomeMessage !== undefined ? { welcomeMessage: String(welcomeMessage).trim() || profile.welcomeMessage } : {}),
      ...(fallbackMessage !== undefined ? { fallbackMessage: String(fallbackMessage).trim() || profile.fallbackMessage } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });

  res.json({ status: 'success', data: { profile: updatedProfile } });
});

const getConversations = asyncHandler(async (req, res) => {
  const conversations = await listConversations();
  res.json({ status: 'success', data: { conversations } });
});

const getConversation = asyncHandler(async (req, res, next) => {
  const conversation = await getConversationById(req.params.id);
  if (!conversation) return next(new NotFoundError('Conversacion no encontrada.'));
  res.json({ status: 'success', data: { conversation } });
});

const replyConversation = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  if (!content?.trim()) return next(new BadRequestError('La respuesta no puede estar vacia.'));

  const conversation = await prisma.chatConversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) return next(new NotFoundError('Conversacion no encontrada.'));

  const cleanContent = content.trim();
  const senderName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ')
    || req.user?.email
    || 'Equipo Tecnotitlan';
  let delivery = null;

  if (conversation.channel === 'WHATSAPP') {
    if (!conversation.externalUserId) {
      return next(new BadRequestError('Esta conversacion no tiene destino de WhatsApp.'));
    }

    try {
      delivery = await sendWhatsAppMessage(conversation.externalUserId, cleanContent, senderName);
    } catch (error) {
      return next(new BadRequestError(`No se pudo enviar por WhatsApp: ${error.message}`));
    }
  }

  await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'HUMAN',
      content: cleanContent,
      metadata: {
        sentBy: req.user?.email,
        sentByName: senderName,
        delivery,
      },
    },
  });

  await prisma.conversationHandoff.updateMany({
    where: { conversationId: conversation.id, status: 'OPEN' },
    data: { status: 'ASSIGNED', assignedTo: req.user?.id || null },
  });

  const updatedConversation = await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: { status: 'OPEN', lastMessageAt: new Date() },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      handoffs: { orderBy: { createdAt: 'desc' } },
    },
  });

  res.status(201).json({ status: 'success', data: { conversation: updatedConversation } });
});

const closeConversation = asyncHandler(async (req, res, next) => {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) return next(new NotFoundError('Conversacion no encontrada.'));

  const updatedConversation = await prisma.$transaction(async (tx) => {
    await tx.conversationHandoff.updateMany({
      where: { conversationId: conversation.id, status: { not: 'RESOLVED' } },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    return tx.chatConversation.update({
      where: { id: conversation.id },
      data: { status: 'CLOSED' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        handoffs: { orderBy: { createdAt: 'desc' } },
      },
    });
  });

  res.json({ status: 'success', data: { conversation: updatedConversation } });
});

const getKnowledgeArticles = asyncHandler(async (req, res) => {
  const articles = await prisma.knowledgeArticle.findMany({
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });
  res.json({ status: 'success', data: { articles } });
});

const createKnowledgeArticle = asyncHandler(async (req, res, next) => {
  const { title, category, content, tags = [], isActive = true } = req.body;
  if (!title?.trim() || !category?.trim() || !content?.trim()) {
    return next(new BadRequestError('Titulo, categoria y contenido son obligatorios.'));
  }

  const article = await prisma.knowledgeArticle.create({
    data: {
      storeId: 'default',
      title: title.trim(),
      category: category.trim().toLowerCase(),
      content: content.trim(),
      tags: normalizeTags(tags),
      isActive: Boolean(isActive),
    },
  });

  res.status(201).json({ status: 'success', data: { article } });
});

const updateKnowledgeArticle = asyncHandler(async (req, res, next) => {
  const { title, category, content, tags, isActive } = req.body;
  try {
    const article = await prisma.knowledgeArticle.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(category !== undefined ? { category: String(category).trim().toLowerCase() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
        ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    res.json({ status: 'success', data: { article } });
  } catch (error) {
    if (error.code === 'P2025') return next(new NotFoundError('Articulo no encontrado.'));
    return next(error);
  }
});

const deleteKnowledgeArticle = asyncHandler(async (req, res, next) => {
  try {
    await prisma.knowledgeArticle.delete({ where: { id: req.params.id } });
    res.json({ status: 'success', message: 'Articulo eliminado.' });
  } catch (error) {
    if (error.code === 'P2025') return next(new NotFoundError('Articulo no encontrado.'));
    return next(error);
  }
});

export {
  closeConversation,
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  getConversation,
  getConversations,
  getKnowledgeArticles,
  getProfile,
  replyConversation,
  sendPublicMessage,
  updateKnowledgeArticle,
  updateProfile,
};
