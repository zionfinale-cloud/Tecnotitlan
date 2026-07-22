import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { sendTransactionalMail } from './emailService.js';
import * as whatsappService from './whatsappService.js';
import { getConfig } from './configService.js';
import { writeNotificationLog } from './notificationLogService.js';

const OPERATIONAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'VENDEDOR'];

const STATUS_LABELS = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PROCESSING: 'Preparando',
  PENDING_FULFILLMENT: 'Por surtir',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const CHANNEL_LABELS = {
  WEB: 'Web',
  MERCADOLIBRE: 'Mercado Libre',
  TIKTOK_SHOP: 'TikTok Shop',
  AMAZON: 'Amazon',
};

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const onlyDigits = (value = '') => String(value || '').replace(/\D/g, '');

const normalizePhone = (value = '') => {
  let digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length >= 10) return `52${digits.slice(-10)}`;
  return digits;
};

const getCustomerName = (order) => {
  const fullName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ');
  return fullName || order.user?.email || 'Cliente';
};

const getChannelLabel = (order) => CHANNEL_LABELS[order.salesChannel] || order.salesChannel || 'Web';
const getStatusLabel = (status) => STATUS_LABELS[status] || status || 'Sin estado';

const getOrderItems = (order) => (order.orderItems || []).map((item) => ({
  sku: item.product?.sku || '',
  name: item.name || item.product?.name || 'Producto',
  qty: item.qty || 0,
}));

const itemsText = (order) => getOrderItems(order)
  .map((item) => `- ${item.sku ? `${item.sku} - ` : ''}${item.name} x${item.qty}`)
  .join('\n');

const itemsHtml = (order) => getOrderItems(order)
  .map((item) => `<li>${escapeHtml(item.sku ? `${item.sku} - ` : '')}${escapeHtml(item.name)} x${item.qty}</li>`)
  .join('');

const getStaffRecipients = async () => prisma.user.findMany({
  where: {
    role: {
      name: { in: OPERATIONAL_ROLES },
    },
  },
  include: {
    role: true,
  },
});

const buildEmailHtml = ({ title, preview, order, rows = [] }) => `
  <div style="font-family:Arial,sans-serif;background:#f5f8fb;padding:24px;color:#07111f;">
    <div style="max-width:680px;margin:auto;background:#ffffff;border-radius:18px;border:1px solid #dbe4ee;overflow:hidden;">
      <div style="padding:22px 24px;background:#06111f;color:#ffffff;">
        <p style="margin:0 0 6px;color:#00d084;font-size:12px;text-transform:uppercase;font-weight:800;">Tecnotitlan operativo</p>
        <h1 style="margin:0;font-size:24px;">${escapeHtml(title)}</h1>
        <p style="margin:8px 0 0;color:#cbd5e1;">${escapeHtml(preview)}</p>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <tbody>
            <tr><td style="padding:8px 0;color:#64748b;">Pedido</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(order.orderNumber)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Canal</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(getChannelLabel(order))}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Cliente</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(getCustomerName(order))}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Total</td><td style="padding:8px 0;text-align:right;font-weight:800;color:#00b879;">${currency.format(order.totalPrice || 0)}</td></tr>
            ${rows.map((row) => `<tr><td style="padding:8px 0;color:#64748b;">${escapeHtml(row.label)}</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(row.value)}</td></tr>`).join('')}
          </tbody>
        </table>
        <h2 style="font-size:16px;margin:0 0 10px;">Productos</h2>
        <ul style="margin:0;padding-left:20px;color:#334155;">${itemsHtml(order) || '<li>Sin productos registrados</li>'}</ul>
      </div>
    </div>
  </div>
`;

const sendStaffEmail = async ({ subject, title, preview, order, rows }) => {
  const staff = await getStaffRecipients();
  const recipients = staff
    .filter((user) => user.notificationEmailEnabled !== false && user.email)
    .map((user) => user.email);

  if (recipients.length === 0) {
    logger.info(`[Staff Notifications] Sin destinatarios de correo para ${order.orderNumber}.`);
    await writeNotificationLog({
      channel: 'EMAIL',
      audience: 'STAFF',
      event: subject,
      status: 'SKIPPED',
      provider: 'smtp',
      order,
      message: 'Sin destinatarios de correo operativos habilitados.',
    });
    return;
  }

  await sendTransactionalMail({
    to: recipients,
    subject,
    text: `${title}\n${preview}\nPedido: ${order.orderNumber}\nCanal: ${getChannelLabel(order)}\nCliente: ${getCustomerName(order)}\nTotal: ${currency.format(order.totalPrice || 0)}\n${itemsText(order)}`,
    html: buildEmailHtml({ title, preview, order, rows }),
  });
  await writeNotificationLog({
    channel: 'EMAIL',
    audience: 'STAFF',
    event: subject,
    status: 'SENT',
    provider: 'smtp',
    recipient: recipients.join(', '),
    order,
    message: preview,
    details: { recipients: recipients.length },
  });
};

const sendStaffWhatsApp = async ({ order, message }) => {
  const isReady = await whatsappService.ensureReadyForNotification();
  if (!isReady) {
    logger.warn(`[Staff Notifications] WhatsApp omitido para ${order.orderNumber}: WhatsApp no conectado.`);
    await writeNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event: 'staff_order_notification',
      status: 'SKIPPED',
      provider: 'baileys',
      order,
      message: 'WhatsApp no conectado al momento de notificar al equipo.',
    });
    return;
  }

  const staff = await getStaffRecipients();
  const recipients = staff
    .filter((user) => user.notificationWhatsappEnabled === true)
    .map((user) => ({
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      phone: normalizePhone(user.notificationWhatsapp || user.phone),
    }))
    .filter((recipient) => recipient.phone);

  if (recipients.length === 0) {
    const adminWhatsappNumber = normalizePhone(getConfig().ADMIN_WHATSAPP_NUMBER);
    if (adminWhatsappNumber) {
      recipients.push({ name: 'WhatsApp administrador', phone: adminWhatsappNumber });
    } else {
      logger.info(`[Staff Notifications] Sin destinatarios WhatsApp para ${order.orderNumber}.`);
      await writeNotificationLog({
        channel: 'WHATSAPP',
        audience: 'STAFF',
        event: 'staff_order_notification',
        status: 'SKIPPED',
        provider: 'baileys',
        order,
        message: 'Sin destinatarios WhatsApp operativos habilitados.',
      });
      return;
    }
  }

  const dedupedRecipients = recipients.filter((recipient, index, allRecipients) => (
    allRecipients.findIndex((candidate) => candidate.phone === recipient.phone) === index
  ));

  const results = await Promise.allSettled(
    dedupedRecipients.map((recipient) => whatsappService.sendMessage(recipient.phone, message, 'Sistema'))
  );

  results.forEach((result, index) => {
    const recipient = dedupedRecipients[index];
    if (result.status === 'rejected') {
      logger.warn(`[Staff Notifications] WhatsApp omitido para ${recipient.name}: ${result.reason?.message || result.reason}`);
    }
  });

  await Promise.all(results.map((result, index) => {
    const recipient = dedupedRecipients[index];
    const failed = result.status === 'rejected';
    return writeNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event: 'staff_order_notification',
      status: failed ? 'FAILED' : 'SENT',
      provider: 'baileys',
      recipient: recipient.phone,
      order,
      message: failed ? null : message,
      error: failed ? (result.reason?.message || String(result.reason)) : null,
      details: { recipientName: recipient.name },
    });
  }));
};

export const notifyStaffOrderPaid = async (order) => {
  try {
    const title = 'Nueva venta confirmada';
    const preview = `Entró una venta por ${getChannelLabel(order)} y ya esta lista para preparar.`;
    const message = [
      '*Nueva venta confirmada*',
      `Pedido: ${order.orderNumber}`,
      `Canal: ${getChannelLabel(order)}`,
      `Cliente: ${getCustomerName(order)}`,
      `Total: ${currency.format(order.totalPrice || 0)}`,
      'Productos:',
      itemsText(order) || '- Sin productos registrados',
    ].join('\n');

    await sendStaffEmail({
      subject: `Venta confirmada ${order.orderNumber}`,
      title,
      preview,
      order,
      rows: [{ label: 'Estado', value: getStatusLabel(order.status) }],
    });
    await sendStaffWhatsApp({ order, message });
  } catch (error) {
    logger.warn(`[Staff Notifications] No se pudo avisar venta ${order.orderNumber}: ${error.message}`);
  }
};

export const notifyStaffOrderStatusChanged = async (order, context = {}) => {
  try {
    const previousStatus = getStatusLabel(context.previousStatus);
    const nextStatus = getStatusLabel(context.nextStatus || order.status);
    const title = `Pedido ${order.orderNumber}: ${nextStatus}`;
    const preview = `Cambio de estado en ${getChannelLabel(order)}: ${previousStatus} -> ${nextStatus}.`;
    const message = [
      '*Actualizacion de pedido*',
      `Pedido: ${order.orderNumber}`,
      `Canal: ${getChannelLabel(order)}`,
      `Estado: ${previousStatus} -> ${nextStatus}`,
      context.notes ? `Nota: ${context.notes}` : null,
      order.shippingInfo?.trackingNumber ? `Guia: ${order.shippingInfo.trackingNumber}` : null,
      order.shippingInfo?.trackingUrl ? `Rastreo: ${order.shippingInfo.trackingUrl}` : null,
    ].filter(Boolean).join('\n');

    await sendStaffEmail({
      subject: `Actualizacion ${order.orderNumber}: ${nextStatus}`,
      title,
      preview,
      order,
      rows: [
        { label: 'Estado anterior', value: previousStatus },
        { label: 'Estado nuevo', value: nextStatus },
        ...(context.notes ? [{ label: 'Nota', value: context.notes }] : []),
      ],
    });
    await sendStaffWhatsApp({ order, message });
  } catch (error) {
    logger.warn(`[Staff Notifications] No se pudo avisar cambio de estado ${order.orderNumber}: ${error.message}`);
  }
};
