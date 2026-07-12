import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';
import * as whatsappService from '../services/whatsappService.js';
import { getConfig } from '../services/configService.js';
import { applyPaidOrderInventoryMovements } from '../services/orderInventoryService.js';
import { sendOrderDeliveredEmail, sendOrderPaidEmail, sendOrderShippedEmail } from '../services/emailService.js';
import Stripe from 'stripe';
import axios from 'axios'; // <-- REQUERIDO

let stripe;

/**
 * Obtiene una instancia única de Stripe.
 */
const getStripeInstance = () => {
  if (!stripe) {
    const secretKey = getConfig().STRIPE_SECRET_KEY;
    if (secretKey) stripe = new Stripe(secretKey);
  }
  return stripe;
};

export {
  getOrderByIdOperational,
  getAllOrdersOperational,
  retryOrderInventoryOperational,
  updateOrderStatusOperational,
  updateOrderToDeliveredOperational,
};

const userCanManageOrders = (user) => {
  const permissions = new Set((user?.role?.permissions || []).map(permission => permission.name));
  return user?.role?.name === 'SUPER_ADMIN' || permissions.has('order:update');
};

const userCanAccessOrder = (user, order) => userCanManageOrders(user) || order.userId === user?.id;

const VALID_ORDER_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PROCESSING',
  'PENDING_FULFILLMENT',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

const STATUS_HISTORY_NOTES = {
  PENDING_PAYMENT: 'Pedido creado y pendiente de pago.',
  PROCESSING: 'Pago confirmado. Pedido en preparacion.',
  PENDING_FULFILLMENT: 'Pedido pendiente de surtido o fulfillment.',
  SHIPPED: 'Pedido enviado.',
  DELIVERED: 'Pedido entregado.',
  CANCELLED: 'Pedido cancelado.',
};

const ORDER_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  orderItems: {
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          productType: true,
        },
      },
    },
  },
  statusHistory: { orderBy: { date: 'asc' } },
};

const appendStatusHistory = (tx, orderId, status, notes) => tx.statusHistory.create({
  data: {
    orderId,
    status,
    notes: notes || STATUS_HISTORY_NOTES[status] || 'Estado actualizado.',
  },
});

const appendInventoryWarning = (tx, order, error) => appendStatusHistory(
  tx,
  order.id,
  order.status,
  `Pago confirmado, pero la salida de inventario requiere revision manual: ${error.message}`
);

const buildShippingInfo = (currentInfo = {}, body = {}) => {
  const trackingNumber = body.trackingNumber?.trim();
  const carrier = body.carrier?.trim();
  const trackingUrl = body.trackingUrl?.trim();
  const notes = body.shippingNotes?.trim();

  return {
    ...(currentInfo || {}),
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(carrier ? { carrier } : {}),
    ...(trackingUrl ? { trackingUrl } : {}),
    ...(notes ? { notes } : {}),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * @desc    Crear un nuevo pedido
 * @route   POST /api/orders
 * @access  Private
 */
const addOrderItems = asyncHandler(async (req, res, next) => {
  const config = getConfig();
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
  } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return next(new BadRequestError('No hay artículos en el pedido'));
  }

  // --- Lógica de precios segura en el backend ---
  const productIdentifiers = orderItems.map(item => item.product).filter(Boolean);

  const productsFromDB = await prisma.product.findMany({
    where: {
      OR: [
        { id: { in: productIdentifiers } },
        { sku: { in: productIdentifiers } },
      ],
    },
    include: {
      media: { take: 1, select: { url: true } },
    },
  });

  // Crear un mapa para una búsqueda eficiente por ID y SKU
  const productMap = productsFromDB.reduce((map, product) => {
    map[product.id] = product;
    map[product.sku] = product; 
    return map;
  }, {});
  
  // Verificar que todos los productos solicitados existen
  for (const item of orderItems) {
    if (!productMap[item.product]) {
      return next(new BadRequestError(`Producto con identificador ${item.product} no encontrado.`));
    }

    const dbProduct = productMap[item.product];
    if (dbProduct.productType === 'IN_HOUSE' && dbProduct.countInStock < item.qty) {
      return next(new BadRequestError(`No hay suficiente stock para ${dbProduct.name}. Disponible: ${dbProduct.countInStock}.`));
    }
  }

  const itemsPrice = orderItems.reduce((acc, item) => {
    const dbProduct = productMap[item.product];
    if (!dbProduct) {
      throw new Error('Error de consistencia de datos al calcular precios.');
    }
    return acc + dbProduct.price * item.qty;
  }, 0);

  const shippingPrice = itemsPrice > 1000 ? 0 : 99; // Envío gratis en compras mayores a $1000
  const taxPrice = itemsPrice * 0.16; // 16% de IVA
  
  // --- Lógica de comisiones segura en el backend ---
  const subtotalBeforeFee = itemsPrice + shippingPrice + taxPrice;
  let paymentFee = 0;
  if (paymentMethod === 'PayPal') {
    const PAYPAL_FEE_RATE = parseFloat(config.PAYPAL_FEE_RATE) || 0.045; // 4.5%
    paymentFee = subtotalBeforeFee * PAYPAL_FEE_RATE;
  } else if (paymentMethod === 'Stripe') {
    const STRIPE_FEE_RATE = parseFloat(config.STRIPE_FEE_RATE) || 0.036; // 3.6%
    const STRIPE_FEE_FIXED = parseFloat(config.STRIPE_FEE_FIXED) || 3; // + $3 MXN
    paymentFee = (subtotalBeforeFee * STRIPE_FEE_RATE) + STRIPE_FEE_FIXED;
  }
  const totalPrice = subtotalBeforeFee + paymentFee;
  // --- Fin de la lógica de precios segura ---

  try {
    // Usamos una transacción interactiva de Prisma para asegurar la atomicidad
    const createdOrder = await prisma.$transaction(async (tx) => {
      // 1. Obtener el siguiente número de pedido
      const counter = await tx.counter.upsert({
        where: { id: 'orderNumber' },
        update: { sequenceValue: { increment: 1 } },
        create: { id: 'orderNumber', sequenceValue: 1 },
      });
      const orderNumber = `TECNO-${counter.sequenceValue.toString().padStart(6, '0')}`;

      // 2. Crear el pedido
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: req.user.id,
          itemsPrice,
          shippingPrice,
          taxPrice,
          paymentFee,
          totalPrice,
          shippingAddress, // Prisma maneja el JSON automáticamente
          paymentMethod,
          // 3. Crear los items del pedido y conectarlos
          orderItems: {
            create: orderItems.map(item => {
              const dbProduct = productMap[item.product];
              return {
                productId: dbProduct.id,
                name: dbProduct.name,
                qty: item.qty,
                price: dbProduct.price,
                unitCost: dbProduct.costPrice || 0,
                image: dbProduct.media && dbProduct.media.length > 0 ? dbProduct.media[0].url : '/images/sample.jpg',
              };
            }),
          },
        },
      });

      await appendStatusHistory(tx, order.id, 'PENDING_PAYMENT', 'Pedido creado. Esperando confirmacion de pago.');

      return order;
    });

    // Notificar a n8n solo cuando exista un webhook configurado.
    const n8nWebhookUrl = config.N8N_ORDER_WEBHOOK_URL;
    
    // Payload solo con la data necesaria para n8n
    const payload = {
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        client_whatsapp: createdOrder.shippingAddress.phone || createdOrder.shippingAddress.whatsapp, 
    };

    if (n8nWebhookUrl) {
      axios.post(n8nWebhookUrl, payload)
          .then(() => logger.info(`Webhook enviado a n8n para el pedido ${createdOrder.orderNumber}`))
          .catch(error => logger.error(`Error al enviar webhook a n8n: ${error.message}`));
    }
    res.status(201).json({ status: 'success', data: { order: createdOrder } });
  } catch (error) {
    logger.error(`Error en transacción al crear pedido: ${error.message}`);
    // Si el error es por falta de stock (decremento a negativo), dar un mensaje claro
    if (error.code === 'P2025' && error.meta?.cause?.includes('decrement')) {
        return next(new BadRequestError('No hay suficiente stock para uno de los productos.'));
    }
    next(error);
  }
});

/**
 * @desc    Crear un Payment Intent de Stripe para un pedido
 * @route   POST /api/orders/:id/create-payment-intent
 * @access  Private
 */
const createStripePaymentIntent = asyncHandler(async (req, res, next) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return next(new Error('La configuración de pago de Stripe no está disponible.'));
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });

  if (order && !userCanAccessOrder(req.user, order)) {
    return next(new BadRequestError('No autorizado para pagar este pedido.', 403));
  }

  if (order && !order.isPaid) {
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100), // Stripe requiere el monto en centavos
      currency: 'mxn',
      automatic_payment_methods: { enabled: true },
      metadata: { order_id: order.orderNumber, order_uuid: order.id }, // Usar orderNumber que es string
    });
    // Devolver el client_secret para que el frontend pueda confirmar el pago
    res.send({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } else {
    return next(new NotFoundError('Pedido no encontrado o ya pagado.'));
  }
});

/**
 * @desc    Obtener un pedido por ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res, next) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } }, // Campo User Corregido
      orderItems: {
        // CORRECCIÓN FINAL: Usamos SELECT anidado para devolver los campos de OrderItem
        // MÁS el SKU del producto, que OrderScreen necesita (item.product.sku)
        select: {
          id: true,
          name: true,
          qty: true,
          price: true,
          image: true,
          productId: true,
          product: { // Incluimos la relación 'product' dentro del select de orderItems
            select: {
                sku: true // Solo necesitamos el SKU para la tabla del frontend
            }
          }
        }
      },
    },
  });

  if (order) {
    // req.user.id viene del token JWT
    if (req.user.role.name === 'SUPER_ADMIN' || order.userId === req.user.id) {
      res.status(200).json({ status: 'success', data: { order } });
    } else {
      return next(new BadRequestError('No autorizado para ver este pedido', 403));
    }
  } else {
    return next(new NotFoundError('Pedido no encontrado'));
  }
});


/**
 * @desc    Confirmar un pago de Stripe validando el PaymentIntent en servidor
 * @route   POST /api/orders/:id/confirm-stripe-payment
 * @access  Private
 */
const confirmStripePayment = asyncHandler(async (req, res, next) => {
  const { paymentIntentId } = req.body;
  if (!paymentIntentId) {
    return next(new BadRequestError('El paymentIntentId es requerido.', 400));
  }

  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return next(new Error('La configuracion de pago de Stripe no esta disponible.'));
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      orderItems: { include: { product: true } },
    },
  });

  if (!order) return next(new NotFoundError('Pedido no encontrado'));
  if (!userCanAccessOrder(req.user, order)) {
    return next(new BadRequestError('No autorizado para pagar este pedido.', 403));
  }
  if (order.isPaid) {
    return res.status(200).json({ status: 'success', data: { order } });
  }
  if (order.paymentMethod !== 'Stripe') {
    return next(new BadRequestError('Este pedido no fue creado para pagarse con Stripe.', 400));
  }

  const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
  const expectedAmount = Math.round(order.totalPrice * 100);

  if (paymentIntent.status !== 'succeeded') {
    return next(new BadRequestError('El pago de Stripe aun no esta confirmado.', 400));
  }
  if (paymentIntent.amount !== expectedAmount || paymentIntent.currency !== 'mxn') {
    return next(new BadRequestError('El monto del pago no coincide con el pedido.', 400));
  }
  if (paymentIntent.metadata?.order_uuid !== order.id && paymentIntent.metadata?.order_id !== order.orderNumber) {
    return next(new BadRequestError('El pago no corresponde a este pedido.', 400));
  }

  const isDropshippingOrder = order.orderItems.some(
    item => item.product.productType === 'DROPSHIPPING'
  );

  const { updatedOrder, shouldNotify } = await prisma.$transaction(async (tx) => {
    const markPaidResult = await tx.order.updateMany({
      where: { id: order.id, isPaid: false },
      data: {
        isPaid: true,
        paidAt: new Date(),
        status: isDropshippingOrder ? 'PENDING_FULFILLMENT' : 'PROCESSING',
        paymentResult: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          update_time: new Date(paymentIntent.created * 1000).toISOString(),
          email_address: paymentIntent.receipt_email || '',
        },
      },
    });

    if (markPaidResult.count === 0) {
      const alreadyPaidOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          orderItems: { include: { product: true } },
        },
      });

      return { updatedOrder: alreadyPaidOrder, shouldNotify: false };
    }

    const paidOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        orderItems: { include: { product: true } },
      },
    });

    await appendStatusHistory(tx, paidOrder.id, paidOrder.status, 'Pago confirmado con tarjeta.');

    try {
      await applyPaidOrderInventoryMovements(tx, paidOrder, req.user.id);
    } catch (error) {
      logger.error(`[Inventory] Pago confirmado sin salida de inventario para ${paidOrder.orderNumber}: ${error.message}`);
      await appendInventoryWarning(tx, paidOrder, error);
    }

    return { updatedOrder: paidOrder, shouldNotify: true };
  });

  if (shouldNotify) {
    await sendOrderPaidEmail(updatedOrder);
    await whatsappService.sendCustomerOrderPaidNotification(updatedOrder);
    whatsappService.sendAdminOrderPaidNotification(updatedOrder);
  }
  res.status(200).json({ status: 'success', data: { order: updatedOrder } });
});

/**
 * @desc    Actualizar pedido a pagado
 * @route   PUT /api/orders/:id/pay
 * @access  Private
 */
const updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const { paymentResult } = req.body;

  // Validación básica del cuerpo de la petición
  if (!paymentResult || !paymentResult.id || !paymentResult.status) {
    return next(new BadRequestError('Los detalles del resultado del pago son requeridos.', 400));
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  });

  if (order) {
    const manualPaymentMethods = ['BANK_TRANSFER', 'MERCADO_LIBRE', 'WHATSAPP'];
    const canManageOrders = userCanManageOrders(req.user);

    if (manualPaymentMethods.includes(order.paymentMethod) && !canManageOrders) {
      return next(new BadRequestError('Solo administradores pueden confirmar pagos manuales.', 403));
    }

    if (order.isPaid) {
      return res.status(200).json({ status: 'success', data: { order } });
    }

    const isDropshippingOrder = order.orderItems.some(
      item => item.product.productType === 'DROPSHIPPING'
    );

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const paidOrder = await tx.order.update({
        where: { id: req.params.id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          status: isDropshippingOrder ? 'PENDING_FULFILLMENT' : 'PROCESSING',
          paymentResult: {
            id: paymentResult.id,
            status: paymentResult.status,
            update_time: paymentResult.update_time,
            email_address: paymentResult.payer ? paymentResult.payer.email_address : '',
          },
        },
        include: ORDER_INCLUDE,
      });

      await appendStatusHistory(tx, paidOrder.id, paidOrder.status, 'Pago confirmado manualmente.');

      try {
        await applyPaidOrderInventoryMovements(tx, paidOrder, req.user.id);
      } catch (error) {
        logger.error(`[Inventory] Pago manual confirmado sin salida de inventario para ${paidOrder.orderNumber}: ${error.message}`);
        await appendInventoryWarning(tx, paidOrder, error);
      }

      return paidOrder;
    });

    await sendOrderPaidEmail(updatedOrder);
    await whatsappService.sendCustomerOrderPaidNotification(updatedOrder);
    whatsappService.sendAdminOrderPaidNotification(updatedOrder);

    res.status(200).json({ status: 'success', data: { order: updatedOrder } });
  } else {
    return next(new NotFoundError('Pedido no encontrado'));
  }
});

/**
 * @desc    Actualizar pedido a entregado
 * @route   PUT /api/orders/:id/deliver
 * @access  Private/Admin
 */
const updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  try {
    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        isDelivered: true,
        deliveredAt: new Date(),
        status: 'DELIVERED',
      },
    });
    res.status(200).json({ status: 'success', data: { order: updatedOrder } });
  } catch (error) {
    // Si Prisma no encuentra el registro para actualizar, lanza un error P2025.
    if (error.code === 'P2025') {
      return next(new NotFoundError('Pedido no encontrado'));
    }
    next(error); // Para cualquier otro tipo de error
  }
});

/**
 * @desc    Actualizar el estado de un pedido (genérico)
 * @route   PUT /api/orders/:id/status
 * @access  Private/Admin
 */
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, trackingNumber } = req.body;
  const dataToUpdate = {};

  if (status) {
    dataToUpdate.status = status;
  }

  if (trackingNumber) {
    // Con Prisma, podemos actualizar un campo JSON de forma segura.
    // Primero leemos el valor actual si existe.
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, select: { shippingInfo: true } });
    if (!order) return next(new NotFoundError('Pedido no encontrado'));

    const newShippingInfo = { ...(order.shippingInfo || {}), trackingNumber };
    dataToUpdate.shippingInfo = newShippingInfo;
    dataToUpdate.status = 'SHIPPED';
    dataToUpdate.shippedAt = new Date();
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        orderItems: true,
      },
    });
    if (trackingNumber) {
      await sendOrderShippedEmail(updatedOrder);
      await whatsappService.sendCustomerOrderShippedNotification(updatedOrder);
    }
    res.status(200).json({ status: 'success', data: { order: updatedOrder } });
  } catch (error) {
    if (error.code === 'P2025') return next(new NotFoundError('Pedido no encontrado'));
    next(error);
  }
});

/**
 * @desc    Obtener los pedidos del usuario logueado
 * @route   GET /api/orders/myorders
 * @access  Private
 */
const getOrderByIdOperational = asyncHandler(async (req, res, next) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  });

  if (!order) return next(new NotFoundError('Pedido no encontrado'));
  if (!userCanAccessOrder(req.user, order)) {
    return next(new BadRequestError('No autorizado para ver este pedido'));
  }

  res.status(200).json({ status: 'success', data: { order } });
});

const getAllOrdersOperational = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ status: 'success', results: orders.length, data: { orders } });
});

const retryOrderInventoryOperational = asyncHandler(async (req, res, next) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  });

  if (!order) return next(new NotFoundError('Pedido no encontrado'));
  if (!order.isPaid) return next(new BadRequestError('Confirma el pago antes de mover inventario.'));

  const inHouseItems = (order.orderItems || []).filter((item) => item.product?.productType === 'IN_HOUSE');
  if (inHouseItems.length === 0) {
    return next(new BadRequestError('Este pedido no tiene productos de inventario propio para descontar.'));
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({
      where: { id: req.params.id },
      include: ORDER_INCLUDE,
    });

    await applyPaidOrderInventoryMovements(tx, currentOrder, req.user.id);
    await appendStatusHistory(
      tx,
      currentOrder.id,
      currentOrder.status,
      'Salida de inventario aplicada/reintentada correctamente desde Pedidos.'
    );

    return tx.order.findUnique({
      where: { id: req.params.id },
      include: ORDER_INCLUDE,
    });
  });

  res.status(200).json({
    status: 'success',
    message: 'Salida de inventario revisada correctamente.',
    data: { order: updatedOrder },
  });
});

const updateOrderStatusOperational = asyncHandler(async (req, res, next) => {
  const {
    status,
    trackingNumber,
    carrier,
    trackingUrl,
    shippingNotes,
    notes,
  } = req.body;

  if (status && !VALID_ORDER_STATUSES.has(status)) {
    return next(new BadRequestError('El estado del pedido no es valido.'));
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  });

  if (!order) return next(new NotFoundError('Pedido no encontrado'));

  const hasShippingUpdate = Boolean(trackingNumber || carrier || trackingUrl || shippingNotes);
  const nextStatus = hasShippingUpdate ? 'SHIPPED' : (status || order.status);

  if (['PROCESSING', 'PENDING_FULFILLMENT', 'SHIPPED', 'DELIVERED'].includes(nextStatus) && !order.isPaid) {
    return next(new BadRequestError('Confirma el pago antes de avanzar el pedido.'));
  }

  const dataToUpdate = {};

  if (nextStatus !== order.status) {
    dataToUpdate.status = nextStatus;
  }

  if (hasShippingUpdate) {
    dataToUpdate.shippingInfo = buildShippingInfo(order.shippingInfo, {
      trackingNumber,
      carrier,
      trackingUrl,
      shippingNotes,
    });
    dataToUpdate.shippedAt = order.shippedAt || new Date();
  }

  if (nextStatus === 'DELIVERED') {
    dataToUpdate.isDelivered = true;
    dataToUpdate.deliveredAt = order.deliveredAt || new Date();
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(200).json({ status: 'success', data: { order } });
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const savedOrder = await tx.order.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: ORDER_INCLUDE,
    });

    await appendStatusHistory(tx, savedOrder.id, nextStatus, notes || STATUS_HISTORY_NOTES[nextStatus]);
    return savedOrder;
  });

  if (hasShippingUpdate) {
    await sendOrderShippedEmail(updatedOrder);
    await whatsappService.sendCustomerOrderShippedNotification(updatedOrder);
  } else if (nextStatus === 'DELIVERED') {
    await sendOrderDeliveredEmail(updatedOrder);
    await whatsappService.sendCustomerOrderDeliveredNotification(updatedOrder);
  } else if (nextStatus === 'CANCELLED') {
    await whatsappService.sendCustomerOrderStatusNotification(updatedOrder);
  }

  res.status(200).json({ status: 'success', data: { order: updatedOrder } });
});

const updateOrderToDeliveredOperational = asyncHandler(async (req, res, next) => {
  req.body = { ...(req.body || {}), status: 'DELIVERED' };
  return updateOrderStatusOperational(req, res, next);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', results: orders.length, data: { orders } });
});

/**
 * @desc    Obtener todos los pedidos (admin)
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', results: orders.length, data: { orders } });
});

export {
  addOrderItems,
  createStripePaymentIntent,
  confirmStripePayment,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
};

