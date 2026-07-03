import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';
import * as whatsappService from '../services/whatsappService.js';
import { getConfig } from '../services/configService.js';
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

      // 4. Actualizar el stock de los productos (solo los In-House)
      for (const item of orderItems) {
        const dbProduct = productMap[item.product];
        if (dbProduct && dbProduct.productType === 'IN_HOUSE') {
                  const stockBefore = dbProduct.countInStock;
                  const stockAfter = stockBefore - item.qty;
                  await tx.product.update({
                    where: { id: dbProduct.id },
                    data: { countInStock: { decrement: item.qty } },
                  });
                  await tx.inventoryMovement.create({
                    data: {
                      type: 'SALE',
                      productId: dbProduct.id,
                      quantity: item.qty,
                      unitCost: dbProduct.costPrice || 0,
                      unitPrice: dbProduct.price,
                      totalCost: item.qty * (dbProduct.costPrice || 0),
                      totalRevenue: item.qty * dbProduct.price,
                      stockBefore,
                      stockAfter,
                      referenceType: 'ORDER',
                      referenceId: order.id,
                      notes: `Venta en pedido ${order.orderNumber}`,
                      createdById: req.user.id,
                    },
                  });
                }
      }

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

  if (order && !order.isPaid) {
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100), // Stripe requiere el monto en centavos
      currency: 'mxn',
      metadata: { order_id: order.orderNumber }, // Usar orderNumber que es string
    });
    // Devolver el client_secret para que el frontend pueda confirmar el pago
    res.send({ clientSecret: paymentIntent.client_secret });
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
    include: { orderItems: { include: { product: true } } },
  });

  if (order) {
    const isDropshippingOrder = order.orderItems.some(
      item => item.product.productType === 'DROPSHIPPING'
    );

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        status: isDropshippingOrder ? 'PENDING_FULFILLMENT' : 'PROCESSING',
        paymentResult: { // Prisma maneja JSON
          id: paymentResult.id,
          status: paymentResult.status,
          update_time: paymentResult.update_time,
          email_address: paymentResult.payer ? paymentResult.payer.email_address : '', // Corregido: removido el doble .payer
        },
      },
    });
    
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
    });
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
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
};

