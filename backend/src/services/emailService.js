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

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const getCustomerName = (order) => {
  const fullName = [order?.user?.firstName, order?.user?.lastName].filter(Boolean).join(' ');
  return fullName || order?.shippingAddress?.name || 'Cliente Tecnotitlan';
};

const getCustomerEmail = (order) => order?.user?.email || order?.shippingAddress?.email || null;
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildOrderItemsRows = (order) => (order?.orderItems || []).map((item) => `
  <tr>
    <td style="padding:12px;border-bottom:1px solid #e6edf2;">
      <strong>${escapeHtml(item.name)}</strong><br>
      <span style="color:#60707c;font-size:13px;">Cantidad: ${item.qty}</span>
    </td>
    <td style="padding:12px;border-bottom:1px solid #e6edf2;text-align:right;">${currency.format(item.price || 0)}</td>
  </tr>
`).join('');

const buildEmailShell = ({ title, preview, body }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f4f8f6;font-family:Arial,Helvetica,sans-serif;color:#08111f;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preview}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8f6;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #dce8e3;border-radius:22px;overflow:hidden;box-shadow:0 22px 60px rgba(6,20,16,.08);">
            <tr>
              <td style="background:#050b0d;padding:26px 30px;">
                <div style="font-size:24px;font-weight:900;letter-spacing:.08em;color:#ffffff;">TECNOTITLAN</div>
                <div style="margin-top:4px;color:#10d99a;font-size:13px;">Tecnologia con raices, poder sin limites.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="background:#f7fbf9;padding:20px 30px;color:#60707c;font-size:13px;">
                <p style="margin:0 0 6px;">Tecnotitlan</p>
                <p style="margin:0;">Dudas o soporte: <a href="mailto:hola@tecnotitlan.com.mx" style="color:#00b879;">hola@tecnotitlan.com.mx</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export const sendOrderPaidEmail = async (order) => {
  const to = getCustomerEmail(order);
  if (!to) {
    logger.warn(`[Email] Pedido ${order?.orderNumber || order?.id} sin correo de cliente. No se envio confirmacion.`);
    return;
  }

  const trackingUrl = `${config.CLIENT_URL_PRIMARY}/order/${order.id}`;
  const body = `
    <p style="margin:0 0 10px;color:#00b879;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Pago confirmado</p>
    <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">Gracias por tu compra, ${escapeHtml(getCustomerName(order))}.</h1>
    <p style="margin:0 0 22px;color:#4d5f67;font-size:16px;">Recibimos tu pago y ya estamos preparando tu pedido.</p>

    <div style="background:#effcf7;border:1px solid #b8f3dd;border-radius:16px;padding:18px;margin-bottom:22px;">
      <strong style="display:block;font-size:18px;">Pedido ${escapeHtml(order.orderNumber)}</strong>
      <span style="color:#4d5f67;">Total pagado: ${currency.format(order.totalPrice || 0)}</span>
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
      ${buildOrderItemsRows(order)}
    </table>

    <a href="${trackingUrl}" style="display:inline-block;background:#10d99a;color:#03100c;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">Ver seguimiento</a>
  `;

  try {
    await transporter.sendMail({
      from: config.EMAIL_FROM,
      to,
      subject: `Confirmacion de compra ${order.orderNumber}`,
      html: buildEmailShell({
        title: `Pedido ${order.orderNumber}`,
        preview: `Tu pago fue confirmado. Pedido ${order.orderNumber}.`,
        body,
      }),
    });
    logger.info(`[Email] Confirmacion de pago enviada para ${order.orderNumber} a ${to}`);
  } catch (error) {
    logger.error(`[Email] No se pudo enviar confirmacion de pago ${order.orderNumber}: ${error.message}`);
  }
};

export const sendOrderShippedEmail = async (order) => {
  const to = getCustomerEmail(order);
  const trackingNumber = order?.shippingInfo?.trackingNumber;
  if (!to || !trackingNumber) return;

  const trackingUrl = `${config.CLIENT_URL_PRIMARY}/order/${order.id}`;
  const body = `
    <p style="margin:0 0 10px;color:#00b879;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Pedido enviado</p>
    <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">Tu pedido va en camino.</h1>
    <p style="margin:0 0 22px;color:#4d5f67;font-size:16px;">Ya registramos la guia de envio para el pedido ${order.orderNumber}.</p>

    <div style="background:#effcf7;border:1px solid #b8f3dd;border-radius:16px;padding:18px;margin-bottom:22px;">
      <strong style="display:block;font-size:18px;">Guia: ${escapeHtml(trackingNumber)}</strong>
      <span style="color:#4d5f67;">Consulta el avance desde tu cuenta.</span>
    </div>

    <a href="${trackingUrl}" style="display:inline-block;background:#10d99a;color:#03100c;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">Ver seguimiento</a>
  `;

  try {
    await transporter.sendMail({
      from: config.EMAIL_FROM,
      to,
      subject: `Tu pedido ${order.orderNumber} fue enviado`,
      html: buildEmailShell({
        title: `Envio ${order.orderNumber}`,
        preview: `Tu guia de envio es ${trackingNumber}.`,
        body,
      }),
    });
    logger.info(`[Email] Aviso de envio enviado para ${order.orderNumber} a ${to}`);
  } catch (error) {
    logger.error(`[Email] No se pudo enviar aviso de envio ${order.orderNumber}: ${error.message}`);
  }
};
