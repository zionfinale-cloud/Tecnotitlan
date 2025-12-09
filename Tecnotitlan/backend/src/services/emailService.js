const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { getConfig } = require('./configService');

let transporter;

// El transporter se crea bajo demanda para usar la configuración más reciente
const getTransporter = () => {
  if (!transporter) {
    const config = getConfig();
    transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: parseInt(config.EMAIL_PORT, 10),
      secure: parseInt(config.EMAIL_PORT, 10) === 465, // true para puerto 465, false para otros
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

// Función para formatear la moneda
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

/**
 * Envía un correo de confirmación de pedido al cliente.
 * @param {object} order - El objeto del pedido, populado con los datos del usuario (name, email).
 */
const sendOrderConfirmation = async (order) => {
  if (!order || !order.user || !order.user.email) {
    logger.error('Intento de enviar correo de confirmación sin datos de pedido o email de usuario.');
    return;
  }

  // 2. Construir el contenido HTML del correo
  const orderItemsHtml = order.orderItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name} (x${item.qty})</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.price * item.qty)}</td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
      <h1 style="color: #007bff;">¡Gracias por tu compra, ${order.user.name}!</h1>
      <p>Hemos recibido tu pedido y lo estamos procesando. Aquí tienes los detalles:</p>
      <h2 style="border-bottom: 2px solid #007bff; padding-bottom: 5px;">Pedido #${order.orderNumber}</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 10px; background-color: #f2f2f2;">Producto</th>
            <th style="text-align: right; padding: 10px; background-color: #f2f2f2;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${orderItemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="text-align: right; padding: 10px; font-weight: bold;">Subtotal:</td>
            <td style="text-align: right; padding: 10px;">${formatCurrency(order.itemsPrice)}</td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 10px; font-weight: bold;">Envío:</td>
            <td style="text-align: right; padding: 10px;">${formatCurrency(order.shippingPrice)}</td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 10px; font-weight: bold;">Total:</td>
            <td style="text-align: right; padding: 10px; font-weight: bold; font-size: 1.2em;">${formatCurrency(order.totalPrice)}</td>
          </tr>
        </tfoot>
      </table>

      <h3>Dirección de Envío</h3>
      <p>
        ${order.shippingAddress.address}<br>
        ${order.shippingAddress.city}, ${order.shippingAddress.postalCode}<br>
        ${order.shippingAddress.country}
      </p>
      
      <p>Puedes ver los detalles completos de tu pedido en tu perfil.</p>
      <p>Gracias por confiar en PowerUpMovil.</p>
    </div>
  `;

  // 3. Definir las opciones del correo
  const mailOptions = {
    from: `"PowerUpMovil" <${getConfig().EMAIL_USER}>`,
    to: order.user.email,
    subject: `Confirmación de tu pedido #${order.orderNumber}`,
    html: htmlContent,
  };

  // 4. Enviar el correo
  try {
    const info = await getTransporter().sendMail(mailOptions);
    logger.info(`Correo de confirmación enviado a ${order.user.email}: ${info.messageId}`);
  } catch (error) {
    logger.error(`Error al enviar correo de confirmación a ${order.user.email}:`, error);
    // No relanzamos el error para no detener el flujo principal de la creación del pedido.
  }
};

/**
 * Envía un correo de notificación de envío al cliente.
 * @param {object} order - El objeto del pedido, populado con los datos del usuario.
 * @param {string} shippingGuide - El número de guía del envío.
 */
const sendOrderShippedNotification = async (order, shippingGuide) => {
  if (!order || !order.user || !order.user.email) {
    logger.error('Intento de enviar correo de envío sin datos de pedido o email de usuario.');
    return;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
      <h1 style="color: #28a745;">¡Tu pedido ha sido enviado, ${order.user.name}!</h1>
      <p>Tu pedido <strong>#${order.orderNumber}</strong> ya está en camino.</p>
      <p>Puedes rastrearlo con la siguiente guía:</p>
      <p style="font-size: 1.2em; font-weight: bold; background-color: #f2f2f2; padding: 10px; border-radius: 5px; text-align: center;">
        ${shippingGuide}
      </p>
      <p>Gracias por confiar en PowerUpMovil.</p>
    </div>
  `;

  const mailOptions = {
    from: `"PowerUpMovil" <${getConfig().EMAIL_USER}>`,
    to: order.user.email,
    subject: `¡Tu pedido #${order.orderNumber} ha sido enviado!`,
    html: htmlContent,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    logger.info(`Correo de envío enviado a ${order.user.email}: ${info.messageId}`);
  } catch (error) {
    logger.error(`Error al enviar correo de envío a ${order.user.email}:`, error);
  }
};

module.exports = {
  sendOrderConfirmation,
  sendOrderShippedNotification,
};
