import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import logger from '../utils/logger.js'; // Asumiendo que tienes un logger, si no, usa console

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT == 465, // true para 465, false para otros puertos
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

/**
 * Envía un correo de verificación con el Link Mágico.
 * @param {string} to - Email del destinatario.
 * @param {string} token - Token de verificación.
 */
export const sendVerificationEmail = async (to, token) => {
  const verificationUrl = `${config.CLIENT_URL_PRIMARY}/verify-email?token=${token}`;

  const mailOptions = {
    from: config.EMAIL_FROM,
    to: to,
    subject: 'Verifica tu cuenta en Tecnotitlan',
    html: `
      <h1>¡Bienvenido a Tecnotitlan!</h1>
      <p>Por favor verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verificar Correo</a>
      <p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Correo de verificación enviado a ${to}`);
  } catch (error) {
    logger.error('Error enviando correo de verificación:', error);
    throw new Error('No se pudo enviar el correo de verificación.');
  }
};

export const sendSupportTicketNotification = async (ticket) => {
  if (!config.SUPPORT_EMAIL) return;

  await transporter.sendMail({
    from: config.EMAIL_FROM,
    to: config.SUPPORT_EMAIL,
    replyTo: ticket.email,
    subject: `[${ticket.ticketNumber}] ${ticket.subject}`,
    text: [
      `Nuevo ticket ${ticket.ticketNumber}`,
      `Cliente: ${ticket.name}`,
      `Email: ${ticket.email}`,
      `Teléfono: ${ticket.phone || 'No proporcionado'}`,
      `Origen: ${ticket.source}`,
      '',
      ticket.message,
    ].join('\n'),
  });
};
