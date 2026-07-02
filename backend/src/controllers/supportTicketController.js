import asyncHandler from 'express-async-handler';
import axios from 'axios';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';
import { getConfig } from '../services/configService.js';
import { sendSupportTicketNotification } from '../services/emailService.js';
import logger from '../utils/logger.js';

const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const createSupportTicket = asyncHandler(async (req, res, next) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return next(new BadRequestError('Nombre, email, asunto y mensaje son obligatorios.'));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length > 120 || subject.length > 180 || message.length > 5000) {
    return next(new BadRequestError('Revisa el email y la longitud de los campos enviados.'));
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { id: 'supportTicket' },
      update: { sequenceValue: { increment: 1 } },
      create: { id: 'supportTicket', sequenceValue: 1 },
    });

    return tx.supportTicket.create({
      data: {
        ticketNumber: `SOP-${counter.sequenceValue.toString().padStart(6, '0')}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        subject: subject.trim(),
        message: message.trim(),
        source: 'WEB',
        userId: req.user?.id || null,
      },
    });
  });

  const webhookUrl = getConfig().N8N_SUPPORT_WEBHOOK_URL;
  Promise.allSettled([
    sendSupportTicketNotification(ticket),
    webhookUrl ? axios.post(webhookUrl, { event: 'support.ticket.created', ticket }) : Promise.resolve(),
  ]).then(results => {
    results.filter(result => result.status === 'rejected')
      .forEach(result => logger.error(`No se pudo notificar ticket ${ticket.ticketNumber}: ${result.reason?.message}`));
  });

  res.status(201).json({
    status: 'success',
    message: 'Recibimos tu solicitud. Nuestro equipo dará seguimiento.',
    data: { ticketNumber: ticket.ticketNumber },
  });
});

const getSupportTickets = asyncHandler(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ status: 'success', data: { tickets } });
});

const updateSupportTicket = asyncHandler(async (req, res, next) => {
  const { status, priority, assignedTo, resolution } = req.body;
  if (status && !validStatuses.includes(status)) return next(new BadRequestError('Estado de ticket inválido.'));
  if (priority && !validPriorities.includes(priority)) return next(new BadRequestError('Prioridad inválida.'));

  try {
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status, priority, assignedTo, resolution },
    });
    res.json({ status: 'success', data: { ticket } });
  } catch (error) {
    if (error.code === 'P2025') return next(new NotFoundError('Ticket no encontrado.'));
    return next(error);
  }
});

export { createSupportTicket, getSupportTickets, updateSupportTicket };
