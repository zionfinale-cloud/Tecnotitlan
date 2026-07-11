import nodemailer from 'nodemailer';
import { getConfig } from './configService.js';
import logger from '../utils/logger.js';

const DEFAULT_EMAIL_FROM = 'Tecnotitlan NoReply <noreply@tecnotitlan.com.mx>';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const getEmailConfig = () => {
  const runtimeConfig = getConfig();
  const emailConfig = {
    ...runtimeConfig,
    SMTP_HOST: runtimeConfig.SMTP_HOST || process.env.SMTP_HOST,
    SMTP_PORT: runtimeConfig.SMTP_PORT || process.env.SMTP_PORT,
    SMTP_USER: runtimeConfig.SMTP_USER || process.env.SMTP_USER,
    SMTP_PASS: runtimeConfig.SMTP_PASS || process.env.SMTP_PASS,
    EMAIL_FROM: runtimeConfig.EMAIL_FROM || process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
  };
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    .filter((key) => !emailConfig[key]);

  if (missing.length > 0) {
    throw new Error(`SMTP incompleto. Faltan variables: ${missing.join(', ')}`);
  }

  return emailConfig;
};

const createTransporter = () => {
  const runtimeConfig = getEmailConfig();
  const port = Number(runtimeConfig.SMTP_PORT || 465);

  return nodemailer.createTransport({
    host: runtimeConfig.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: runtimeConfig.SMTP_USER,
      pass: runtimeConfig.SMTP_PASS,
    },
  });
};

const sendTransactionalMail = async (mailOptions) => {
  const runtimeConfig = getEmailConfig();
  const transporter = createTransporter();

  return transporter.sendMail({
    from: runtimeConfig.EMAIL_FROM || DEFAULT_EMAIL_FROM,
    ...mailOptions,
  });
};

export const verifyEmailTransport = async () => {
  const runtimeConfig = getEmailConfig();
  const transporter = createTransporter();
  await transporter.verify();
  logger.info(`[Email] SMTP listo en ${runtimeConfig.SMTP_HOST}:${runtimeConfig.SMTP_PORT} como ${runtimeConfig.SMTP_USER}`);
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getCustomerName = (order) => {
  const fullName = [order?.user?.firstName, order?.user?.lastName].filter(Boolean).join(' ');
  return fullName || order?.shippingAddress?.name || 'Cliente Tecnotitlan';
};

const getCustomerEmail = (order) => order?.user?.email || order?.shippingAddress?.email || null;

const buildEmailShell = ({ title, preview, body }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4f8f6;font-family:Arial,Helvetica,sans-serif;color:#08111f;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preview)}</span>
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

const buildOrderItemsRows = (order) => (order?.orderItems || []).map((item) => `
  <tr>
    <td style="padding:12px;border-bottom:1px solid #e6edf2;">
      <strong>${escapeHtml(item.name)}</strong><br>
      <span style="color:#60707c;font-size:13px;">Cantidad: ${item.qty}</span>
    </td>
    <td style="padding:12px;border-bottom:1px solid #e6edf2;text-align:right;">${currency.format(item.price || 0)}</td>
  </tr>
`).join('');

export const sendVerificationEmail = async (to, token) => {
  const runtimeConfig = getConfig();
  const verificationUrl = `${runtimeConfig.CLIENT_URL_PRIMARY}/verify-email?token=${token}`;

  const body = `
    <p style="margin:0 0 10px;color:#00b879;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Activa tu cuenta</p>
    <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">Bienvenido a Tecnotitlan.</h1>
    <p style="margin:0 0 22px;color:#4d5f67;font-size:16px;">Confirma tu correo para poder iniciar sesion y dar seguimiento a tus compras.</p>
    <a href="${verificationUrl}" style="display:inline-block;background:#10d99a;color:#03100c;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">Activar cuenta</a>
    <p style="margin:22px 0 0;color:#60707c;font-size:13px;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
  `;

  try {
    await sendTransactionalMail({
      to,
      subject: 'Activa tu cuenta en Tecnotitlan',
      html: buildEmailShell({
        title: 'Activa tu cuenta',
        preview: 'Confirma tu correo para activar tu cuenta Tecnotitlan.',
        body,
      }),
    });
    logger.info(`[Email] Verificacion enviada a ${to}`);
  } catch (error) {
    logger.error(`[Email] Error enviando verificacion a ${to}: ${error.message}`);
    throw new Error('No se pudo enviar el correo de verificacion. Revisa la configuracion SMTP del backend.');
  }
};

export const sendSupportTicketNotification = async (ticket) => {
  const runtimeConfig = getConfig();
  if (!runtimeConfig.SUPPORT_EMAIL) return;

  await sendTransactionalMail({
    to: runtimeConfig.SUPPORT_EMAIL,
    replyTo: ticket.email,
    subject: `[${ticket.ticketNumber}] ${ticket.subject}`,
    text: [
      `Nuevo ticket ${ticket.ticketNumber}`,
      `Cliente: ${ticket.name}`,
      `Email: ${ticket.email}`,
      `Telefono: ${ticket.phone || 'No proporcionado'}`,
      `Origen: ${ticket.source}`,
      '',
      ticket.message,
    ].join('\n'),
  });
};

export const sendOrderPaidEmail = async (order) => {
  const runtimeConfig = getConfig();
  const to = getCustomerEmail(order);

  if (!to) {
    logger.warn(`[Email] Pedido ${order?.orderNumber || order?.id} sin correo de cliente. No se envio confirmacion.`);
    return;
  }

  const trackingUrl = `${runtimeConfig.CLIENT_URL_PRIMARY}/order/${order.id}`;
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
    await sendTransactionalMail({
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
  const runtimeConfig = getConfig();
  const to = getCustomerEmail(order);
  const trackingNumber = order?.shippingInfo?.trackingNumber;
  const carrier = order?.shippingInfo?.carrier;
  const carrierText = carrier ? `<span style="color:#4d5f67;">Paqueteria: ${escapeHtml(carrier)}</span><br>` : '';
  const trackingLink = order?.shippingInfo?.trackingUrl
    ? `<a href="${escapeHtml(order.shippingInfo.trackingUrl)}" style="display:inline-block;margin-top:12px;color:#00a56d;font-weight:800;">Abrir rastreo de paqueteria</a>`
    : '';

  if (!to || !trackingNumber) return;

  const trackingUrl = `${runtimeConfig.CLIENT_URL_PRIMARY}/order/${order.id}`;
  const body = `
    <p style="margin:0 0 10px;color:#00b879;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Pedido enviado</p>
    <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">Tu pedido va en camino.</h1>
    <p style="margin:0 0 22px;color:#4d5f67;font-size:16px;">Ya registramos la guia de envio para el pedido ${escapeHtml(order.orderNumber)}.</p>

    <div style="background:#effcf7;border:1px solid #b8f3dd;border-radius:16px;padding:18px;margin-bottom:22px;">
      <strong style="display:block;font-size:18px;">Guia: ${escapeHtml(trackingNumber)}</strong>
      ${carrierText}
      <span style="color:#4d5f67;">Consulta el avance desde tu cuenta.</span>
      ${trackingLink}
    </div>

    <a href="${trackingUrl}" style="display:inline-block;background:#10d99a;color:#03100c;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">Ver seguimiento</a>
  `;

  try {
    await sendTransactionalMail({
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

export const sendOrderDeliveredEmail = async (order) => {
  const runtimeConfig = getConfig();
  const to = getCustomerEmail(order);

  if (!to) return;

  const trackingUrl = `${runtimeConfig.CLIENT_URL_PRIMARY}/order/${order.id}`;
  const body = `
    <p style="margin:0 0 10px;color:#00b879;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Pedido entregado</p>
    <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">Tu pedido fue entregado.</h1>
    <p style="margin:0 0 22px;color:#4d5f67;font-size:16px;">Marcamos como entregado el pedido ${escapeHtml(order.orderNumber)}. Gracias por comprar en Tecnotitlan.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
      ${buildOrderItemsRows(order)}
    </table>

    <a href="${trackingUrl}" style="display:inline-block;background:#10d99a;color:#03100c;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">Ver pedido</a>
  `;

  try {
    await sendTransactionalMail({
      to,
      subject: `Tu pedido ${order.orderNumber} fue entregado`,
      html: buildEmailShell({
        title: `Pedido entregado ${order.orderNumber}`,
        preview: `Tu pedido ${order.orderNumber} fue entregado.`,
        body,
      }),
    });
    logger.info(`[Email] Aviso de entrega enviado para ${order.orderNumber} a ${to}`);
  } catch (error) {
    logger.error(`[Email] No se pudo enviar aviso de entrega ${order.orderNumber}: ${error.message}`);
  }
};
