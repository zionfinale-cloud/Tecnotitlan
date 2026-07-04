import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';
import {
  getMessage,
  listMessages,
  sendMessage,
  validateCredentials,
} from '../services/staffMailService.js';

const getInboxMessages = asyncHandler(async (req, res, next) => {
  try {
    const messages = await listMessages(req.body);
    res.json({ status: 'success', data: { messages } });
  } catch (error) {
    return next(new BadRequestError(error.message || 'No se pudo conectar al correo.'));
  }
});

const getInboxMessage = asyncHandler(async (req, res, next) => {
  try {
    const message = await getMessage({ ...req.body, uid: req.params.uid });
    if (!message) return next(new NotFoundError('Correo no encontrado.'));
    res.json({ status: 'success', data: { message } });
  } catch (error) {
    return next(new BadRequestError(error.message || 'No se pudo leer el correo.'));
  }
});

const sendStaffMessage = asyncHandler(async (req, res, next) => {
  try {
    const result = await sendMessage(req.body);
    res.status(201).json({
      status: 'success',
      data: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        sentCopyWarning: result.sentCopyWarning || null,
      },
    });
  } catch (error) {
    return next(new BadRequestError(error.message || 'No se pudo enviar el correo.'));
  }
});

const createTicketFromMail = asyncHandler(async (req, res, next) => {
  const { email, password, uid, customerName, customerEmail, phone, subject, message } = req.body;

  try {
    validateCredentials({ email, password });
  } catch (error) {
    return next(new BadRequestError(error.message));
  }

  if (!customerEmail?.trim() || !subject?.trim() || !message?.trim()) {
    return next(new BadRequestError('Cliente, asunto y mensaje son obligatorios para crear el ticket.'));
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
        name: customerName?.trim() || customerEmail.trim(),
        email: customerEmail.trim().toLowerCase(),
        phone: phone?.trim() || null,
        subject: subject.trim(),
        message: [
          uid ? `Correo origen UID: ${uid}` : null,
          `Buzon origen: ${email.trim().toLowerCase()}`,
          '',
          message.trim(),
        ].filter(Boolean).join('\n'),
        source: 'EMAIL',
        userId: req.user?.id || null,
        assignedTo: req.user?.email || null,
      },
    });
  });

  res.status(201).json({ status: 'success', data: { ticket } });
});

export {
  createTicketFromMail,
  getInboxMessage,
  getInboxMessages,
  sendStaffMessage,
};
