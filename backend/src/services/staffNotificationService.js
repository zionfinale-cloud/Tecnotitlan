import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { sendTransactionalMail } from './emailService.js';
import * as whatsappService from './whatsappService.js';
import { getConfig } from './configService.js';
import { findRecentNotificationLog, writeNotificationLog } from './notificationLogService.js';

const OPERATIONAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'VENDEDOR', 'SELLER', 'SALES'];

const OPERATIONAL_PERMISSION_NAMES = new Set([
  'order:read',
  'order:update',
  'inventory:read',
  'inventory:update',
  'support:update',
  'whatsapp:chat',
]);

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

const MOVEMENT_LABELS = {
  PURCHASE: 'Entrada de mercancia',
  SALE: 'Salida por venta',
  CHANNEL_TRANSFER: 'Traspaso a canal',
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de salida',
  RETURN_IN: 'Devolucion a inventario',
  RETURN_OUT: 'Salida por devolucion',
};

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});
const DEFAULT_STAFF_WHATSAPP_DEDUPE_MS = 15 * 60 * 1000;
const DEFAULT_TECATL_HANDOFF_DEDUPE_MS = 30 * 60 * 1000;

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

const dispatchAdministrativeWhatsApp = async (recipients, message) => {
  try {
    const delivery = await whatsappService.sendAdministrativeAlert({
      recipients: recipients.map((recipient) => recipient.phone),
      message,
      sentBy: 'Sistema',
    });
    if (delivery.mode === 'official_fanout') {
      return recipients.map((recipient) => delivery.results.find((item) => item.recipient === recipient.phone)
        || { recipient: recipient.phone, status: 'rejected', reason: new Error('Sin resultado del proveedor oficial.') });
    }
    return recipients.map((recipient) => ({ recipient: recipient.phone, status: 'fulfilled', value: delivery }));
  } catch (reason) {
    return recipients.map((recipient) => ({ recipient: recipient.phone, status: 'rejected', reason }));
  }
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

const getUserPermissionNames = (user) => {
  const permissionNames = new Set((user.role?.permissions || []).map((permission) => permission.name));

  (user.permissionGrants || []).forEach((grant) => {
    if (grant.permission?.name) permissionNames.add(grant.permission.name);
  });

  (user.permissionDenies || []).forEach((deny) => {
    if (deny.permission?.name) permissionNames.delete(deny.permission.name);
  });

  return permissionNames;
};

const isOperationalRecipient = (user) => {
  if (OPERATIONAL_ROLES.includes(user.role?.name)) return true;

  const permissionNames = getUserPermissionNames(user);
  return Array.from(OPERATIONAL_PERMISSION_NAMES).some((permissionName) => permissionNames.has(permissionName));
};

const getStaffRecipients = async () => {
  const users = await prisma.user.findMany({
    include: {
      role: { include: { permissions: true } },
      permissionGrants: { include: { permission: true } },
      permissionDenies: { include: { permission: true } },
    },
  });

  return users.filter(isOperationalRecipient);
};

const getStaffWhatsappDedupeMs = () => {
  const rawValue = Number(
    getConfig().WHATSAPP_STAFF_NOTIFICATION_DEDUPE_MS
    || process.env.WHATSAPP_STAFF_NOTIFICATION_DEDUPE_MS
    || DEFAULT_STAFF_WHATSAPP_DEDUPE_MS
  );
  return Number.isFinite(rawValue) && rawValue >= 60000
    ? rawValue
    : DEFAULT_STAFF_WHATSAPP_DEDUPE_MS;
};

const getTecatlHandoffDedupeMs = () => {
  const rawValue = Number(
    getConfig().WHATSAPP_TECATL_HANDOFF_DEDUPE_MS
    || process.env.WHATSAPP_TECATL_HANDOFF_DEDUPE_MS
    || DEFAULT_TECATL_HANDOFF_DEDUPE_MS
  );
  return Number.isFinite(rawValue) && rawValue >= 60000
    ? rawValue
    : DEFAULT_TECATL_HANDOFF_DEDUPE_MS;
};

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

const sendStaffWhatsApp = async ({ order, message, event = 'staff_order_notification' }) => {
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
        event,
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

  const dedupeWindowMs = getStaffWhatsappDedupeMs();
  const recipientsToSend = [];

  for (const recipient of dedupedRecipients) {
    const recentLog = await findRecentNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event,
      recipient: recipient.phone,
      order,
      sinceMs: dedupeWindowMs,
    });

    if (recentLog) {
      logger.warn(`[Staff Notifications] WhatsApp omitido para ${recipient.name}: ${event} ya se envio recientemente.`);
      await writeNotificationLog({
        channel: 'WHATSAPP',
        audience: 'STAFF',
        event,
        status: 'SKIPPED',
        provider: 'baileys',
        recipient: recipient.phone,
        order,
        message: 'Aviso a staff omitido para evitar duplicados recientes.',
        details: {
          recipientName: recipient.name,
          dedupeWindowMs,
          skippedBecauseOfLogId: recentLog.id,
          skippedBecauseOfCreatedAt: recentLog.createdAt,
        },
      });
      continue;
    }

    recipientsToSend.push(recipient);
  }

  if (recipientsToSend.length === 0) return;

  const results = await dispatchAdministrativeWhatsApp(recipientsToSend, message);

  results.forEach((result, index) => {
    const recipient = recipientsToSend[index];
    if (result.status === 'rejected') {
      logger.warn(`[Staff Notifications] WhatsApp omitido para ${recipient.name}: ${result.reason?.message || result.reason}`);
    }
  });

  await Promise.all(results.map((result, index) => {
    const recipient = recipientsToSend[index];
    const failed = result.status === 'rejected';
    return writeNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event,
      status: failed ? 'FAILED' : 'SENT',
      provider: 'baileys',
      recipient: recipient.phone,
      order,
      message: failed ? null : message,
      error: failed ? (result.reason?.message || String(result.reason)) : null,
      details: {
        recipientName: recipient.name,
        ...(failed ? {} : { whatsapp: result.value }),
      },
    });
  }));
};

const getMovementLabel = (type) => MOVEMENT_LABELS[type] || type || 'Movimiento';

const getMovementChannelLabel = (movement) => {
  if (!movement.channel) return 'Bodega / Web';
  return CHANNEL_LABELS[movement.channel] || movement.channel;
};

const getMovementProductLabel = (movement) => {
  const sku = movement.product?.sku;
  const name = movement.product?.name || 'Producto';
  return sku ? `${sku} - ${name}` : name;
};

const getMovementStockLabel = (movement) => {
  const before = Number.isFinite(Number(movement.stockBefore)) ? movement.stockBefore : '-';
  const after = Number.isFinite(Number(movement.stockAfter)) ? movement.stockAfter : '-';
  return `${before} -> ${after}`;
};

const getMovementActor = (context = {}) => {
  const actor = context.actor;
  if (!actor) return 'Sistema';
  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return fullName || actor.email || 'Sistema';
};

const buildOperationalEmailHtml = ({ title, preview, movement, rows = [] }) => `
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
            <tr><td style="padding:8px 0;color:#64748b;">Tipo</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(getMovementLabel(movement.type))}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Producto</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(getMovementProductLabel(movement))}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Canal / ubicacion</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(getMovementChannelLabel(movement))}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Cantidad</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(String(movement.quantity || 0))}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Stock</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(getMovementStockLabel(movement))}</td></tr>
            ${rows.map((row) => `<tr><td style="padding:8px 0;color:#64748b;">${escapeHtml(row.label)}</td><td style="padding:8px 0;text-align:right;font-weight:800;">${escapeHtml(row.value)}</td></tr>`).join('')}
          </tbody>
        </table>
        ${movement.notes ? `<p style="margin:0;color:#334155;"><strong>Nota:</strong> ${escapeHtml(movement.notes)}</p>` : ''}
      </div>
    </div>
  </div>
`;

const getStaffWhatsappRecipients = async () => {
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
    }
  }

  return recipients.filter((recipient, index, allRecipients) => (
    allRecipients.findIndex((candidate) => candidate.phone === recipient.phone) === index
  ));
};

const sendStaffOperationalEmail = async ({ subject, title, preview, movement, rows }) => {
  const staff = await getStaffRecipients();
  const recipients = staff
    .filter((user) => user.notificationEmailEnabled !== false && user.email)
    .map((user) => user.email);

  if (recipients.length === 0) {
    await writeNotificationLog({
      channel: 'EMAIL',
      audience: 'STAFF',
      event: 'inventory_movement',
      status: 'SKIPPED',
      provider: 'smtp',
      message: 'Sin destinatarios de correo operativos habilitados.',
      details: { movementId: movement.id, movementType: movement.type },
    });
    return;
  }

  await sendTransactionalMail({
    to: recipients,
    subject,
    text: [
      title,
      preview,
      `Tipo: ${getMovementLabel(movement.type)}`,
      `Producto: ${getMovementProductLabel(movement)}`,
      `Canal / ubicacion: ${getMovementChannelLabel(movement)}`,
      `Cantidad: ${movement.quantity || 0}`,
      `Stock: ${getMovementStockLabel(movement)}`,
      ...(rows || []).map((row) => `${row.label}: ${row.value}`),
      movement.notes ? `Nota: ${movement.notes}` : null,
    ].filter(Boolean).join('\n'),
    html: buildOperationalEmailHtml({ title, preview, movement, rows }),
  });

  await writeNotificationLog({
    channel: 'EMAIL',
    audience: 'STAFF',
    event: 'inventory_movement',
    status: 'SENT',
    provider: 'smtp',
    recipient: recipients.join(', '),
    message: preview,
    details: {
      movementId: movement.id,
      movementType: movement.type,
      recipients: recipients.length,
    },
  });
};

const sendStaffOperationalWhatsApp = async ({ movement, message }) => {
  const recipients = await getStaffWhatsappRecipients();

  if (recipients.length === 0) {
    await writeNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event: 'inventory_movement',
      status: 'SKIPPED',
      provider: 'baileys',
      message: 'Sin destinatarios WhatsApp operativos habilitados.',
      details: { movementId: movement.id, movementType: movement.type },
    });
    return;
  }

  const dedupeWindowMs = getStaffWhatsappDedupeMs();
  const recipientsToSend = [];

  for (const recipient of recipients) {
    const recentLog = await findRecentNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event: 'inventory_movement',
      recipient: recipient.phone,
      sinceMs: dedupeWindowMs,
    });

    if (recentLog) {
      logger.warn(`[Staff Notifications] Inventario omitido para ${recipient.name}: ya hubo aviso reciente.`);
      await writeNotificationLog({
        channel: 'WHATSAPP',
        audience: 'STAFF',
        event: 'inventory_movement',
        status: 'SKIPPED',
        provider: 'baileys',
        recipient: recipient.phone,
        message: 'Movimiento operativo omitido para evitar duplicados recientes.',
        details: {
          movementId: movement.id,
          movementType: movement.type,
          recipientName: recipient.name,
          dedupeWindowMs,
          skippedBecauseOfLogId: recentLog.id,
          skippedBecauseOfCreatedAt: recentLog.createdAt,
        },
      });
      continue;
    }

    recipientsToSend.push(recipient);
  }

  if (recipientsToSend.length === 0) return;

  const results = await dispatchAdministrativeWhatsApp(recipientsToSend, message);

  await Promise.all(results.map((result, index) => {
    const recipient = recipientsToSend[index];
    const failed = result.status === 'rejected';
    return writeNotificationLog({
      channel: 'WHATSAPP',
      audience: 'STAFF',
      event: 'inventory_movement',
      status: failed ? 'FAILED' : 'SENT',
      provider: 'baileys',
      recipient: recipient.phone,
      message: failed ? null : message,
      error: failed ? (result.reason?.message || String(result.reason)) : null,
      details: {
        movementId: movement.id,
        movementType: movement.type,
        recipientName: recipient.name,
        ...(failed ? {} : { whatsapp: result.value }),
      },
    });
  }));
};

export const notifyStaffInventoryMovement = async (movement, context = {}) => {
  try {
    const movementLabel = getMovementLabel(movement.type);
    const productLabel = getMovementProductLabel(movement);
    const channelLabel = getMovementChannelLabel(movement);
    const actor = getMovementActor(context);
    const syncMessage = context.channelSync?.message;
    const title = `Movimiento operativo: ${movementLabel}`;
    const preview = `${productLabel} | ${movement.quantity || 0} pza(s) | ${channelLabel}.`;
    const rows = [
      { label: 'Registrado por', value: actor },
      ...(syncMessage ? [{ label: 'Sincronizacion', value: syncMessage }] : []),
    ];
    const message = [
      '*Movimiento de inventario*',
      `Tipo: ${movementLabel}`,
      `Producto: ${productLabel}`,
      `Canal/ubicacion: ${channelLabel}`,
      `Cantidad: ${movement.quantity || 0} pza(s)`,
      `Stock: ${getMovementStockLabel(movement)}`,
      `Registrado por: ${actor}`,
      movement.notes ? `Nota: ${movement.notes}` : null,
      syncMessage ? `Sincronizacion: ${syncMessage}` : null,
    ].filter(Boolean).join('\n');

    await sendStaffOperationalEmail({
      subject: `Movimiento ${movementLabel}: ${productLabel}`,
      title,
      preview,
      movement,
      rows,
    });
    await sendStaffOperationalWhatsApp({ movement, message });
  } catch (error) {
    logger.warn(`[Staff Notifications] No se pudo avisar movimiento ${movement?.id || ''}: ${error.message}`);
  }
};

export const notifyStaffOrderPaid = async (order) => {
  try {
    const title = 'Nueva venta confirmada';
    const preview = `Entro una venta por ${getChannelLabel(order)} y ya esta lista para preparar.`;
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
    await sendStaffWhatsApp({ order, message, event: 'staff_order_paid_whatsapp' });
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
    await sendStaffWhatsApp({ order, message, event: `staff_order_status_${String(context.nextStatus || order.status || 'unknown').toLowerCase()}_whatsapp` });
  } catch (error) {
    logger.warn(`[Staff Notifications] No se pudo avisar cambio de estado ${order.orderNumber}: ${error.message}`);
  }
};

export const notifyStaffImportantInboxCase = async ({ event, title, message, externalId, order = null, recipientUserIds = [], recipientRoles = [] } = {}) => {
  try {
    if (!event || !title || !message) return;
    const requestedUsers = new Set(recipientUserIds.filter(Boolean));
    const requestedRoles = new Set(recipientRoles.filter(Boolean));
    const staff = (await getStaffRecipients()).filter((user) => (
      OPERATIONAL_ROLES.includes(user.role?.name)
      && (!requestedUsers.size || requestedUsers.has(user.id))
      && (!requestedRoles.size || requestedRoles.has(user.role?.name))
    ));
    const eventName = `important_inbox_${event}_${externalId || order?.id || 'unknown'}`;
    const detailUrl = `${getConfig().WEB_URL || process.env.WEB_URL || 'https://tecnotitlan.com.mx'}/admin/inbox`;
    const baseDetails = { externalId: externalId || null, caseEvent: event, detailUrl };
    const emailRecipients = staff.filter((user) => user.notificationEmailEnabled !== false && user.email);

    for (const user of emailRecipients) {
      const recent = await findRecentNotificationLog({
        channel: 'EMAIL', audience: 'STAFF', event: eventName, recipient: user.email,
        order, sinceMs: 365 * 24 * 60 * 60 * 1000,
      });
      if (recent) continue;
      try {
        await sendTransactionalMail({
          to: user.email,
          subject: `[Atención requerida] ${title}`,
          text: `${title}\n\n${message}\n${order?.orderNumber ? `Pedido: ${order.orderNumber}\n` : ''}Abrir Bandeja unificada: ${detailUrl}`,
          html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#172033"><h1 style="color:#b91c1c">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${order?.orderNumber ? `<p><strong>Pedido:</strong> ${escapeHtml(order.orderNumber)}</p>` : ''}<p><a href="${escapeHtml(detailUrl)}">Abrir Bandeja unificada</a></p></div>`,
        });
        await writeNotificationLog({ channel: 'EMAIL', audience: 'STAFF', event: eventName, status: 'SENT', provider: 'smtp', recipient: user.email, order, message, details: baseDetails });
      } catch (error) {
        await writeNotificationLog({ channel: 'EMAIL', audience: 'STAFF', event: eventName, status: 'FAILED', provider: 'smtp', recipient: user.email, order, error: error.message, details: baseDetails });
      }
    }

    const whatsappRecipients = staff
      .filter((user) => user.notificationWhatsappEnabled === true)
      .map((user) => ({ name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email, phone: normalizePhone(user.notificationWhatsapp || user.phone) }))
      .filter((recipient, index, all) => recipient.phone && all.findIndex((candidate) => candidate.phone === recipient.phone) === index);
    const whatsappMessage = `*${title}*\n${message}${order?.orderNumber ? `\nPedido: ${order.orderNumber}` : ''}\nBandeja: ${detailUrl}`;
    const whatsappRecipientsToSend = [];
    for (const recipient of whatsappRecipients) {
      const recent = await findRecentNotificationLog({
        channel: 'WHATSAPP', audience: 'STAFF', event: eventName, recipient: recipient.phone,
        order, sinceMs: 365 * 24 * 60 * 60 * 1000,
      });
      if (recent) continue;
      whatsappRecipientsToSend.push(recipient);
    }
    const whatsappResults = await dispatchAdministrativeWhatsApp(whatsappRecipientsToSend, whatsappMessage);
    for (let index = 0; index < whatsappResults.length; index += 1) {
      const result = whatsappResults[index];
      const recipient = whatsappRecipientsToSend[index];
      const failed = result.status === 'rejected';
      await writeNotificationLog({
        channel: 'WHATSAPP', audience: 'STAFF', event: eventName,
        status: failed ? 'FAILED' : 'SENT', provider: result.value?.provider || 'whatsapp',
        recipient: recipient.phone, order, message: failed ? null : whatsappMessage,
        error: failed ? (result.reason?.message || String(result.reason)) : null,
        details: { ...baseDetails, recipientName: recipient.name, ...(failed ? {} : { whatsapp: result.value }) },
      });
    }
  } catch (error) {
    logger.warn(`[Staff Notifications] No se pudo avisar caso importante ${externalId || ''}: ${error.message}`);
  }
};
