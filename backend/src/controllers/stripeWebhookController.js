import asyncHandler from 'express-async-handler';
import Stripe from 'stripe';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { getConfig } from '../services/configService.js';
import * as whatsappService from '../services/whatsappService.js';
import { applyPaidOrderInventoryMovements } from '../services/orderInventoryService.js';
import { sendOrderPaidEmail } from '../services/emailService.js';

let stripe;

const getStripeInstance = () => {
  if (!stripe) {
    const secretKey = getConfig().STRIPE_SECRET_KEY;
    if (secretKey) stripe = new Stripe(secretKey);
  }
  return stripe;
};

const appendInventoryWarning = (tx, order, error) => tx.statusHistory.create({
  data: {
    orderId: order.id,
    status: order.status,
    notes: `Pago confirmado por Stripe, pero la salida de inventario requiere revision manual: ${error.message}`,
  },
});

const markStripeOrderPaid = async (paymentIntent) => {
  const orderUuid = paymentIntent.metadata?.order_uuid;
  const orderNumber = paymentIntent.metadata?.order_id;

  if (!orderUuid && !orderNumber) {
    logger.warn('[Stripe Webhook] PaymentIntent sin metadata de pedido.', { paymentIntentId: paymentIntent.id });
    return null;
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        orderUuid ? { id: orderUuid } : undefined,
        orderNumber ? { orderNumber } : undefined,
      ].filter(Boolean),
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      orderItems: { include: { product: true } },
    },
  });

  if (!order) {
    logger.warn('[Stripe Webhook] Pedido no encontrado para PaymentIntent.', {
      paymentIntentId: paymentIntent.id,
      orderUuid,
      orderNumber,
    });
    return null;
  }

  const wasAlreadyPaid = order.isPaid;

  if (order.paymentMethod !== 'Stripe') {
    logger.warn('[Stripe Webhook] Pedido no usa Stripe como metodo de pago.', {
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
    });
    return null;
  }

  const expectedAmount = Math.round(order.totalPrice * 100);
  if (paymentIntent.amount !== expectedAmount || paymentIntent.currency !== 'mxn') {
    logger.error('[Stripe Webhook] Monto o moneda no coincide con el pedido.', {
      orderNumber: order.orderNumber,
      expectedAmount,
      stripeAmount: paymentIntent.amount,
      stripeCurrency: paymentIntent.currency,
    });
    return null;
  }

  const isDropshippingOrder = order.orderItems.some(
    item => item.product.productType === 'DROPSHIPPING'
  );

  const { updatedOrder, shouldNotify } = await prisma.$transaction(async (tx) => {
    let paidOrder = order;

    if (!order.isPaid) {
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
            source: 'stripe_webhook',
          },
        },
      });

      paidOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          orderItems: { include: { product: true } },
        },
      });

      if (markPaidResult.count === 0) {
        return { updatedOrder: paidOrder, shouldNotify: false };
      }
    }

    try {
      await applyPaidOrderInventoryMovements(tx, paidOrder);
    } catch (error) {
      logger.error(`[Inventory] Webhook Stripe sin salida de inventario para ${paidOrder.orderNumber}: ${error.message}`);
      await appendInventoryWarning(tx, paidOrder, error);
    }

    return { updatedOrder: paidOrder, shouldNotify: !wasAlreadyPaid };
  });

  if (shouldNotify) {
    await sendOrderPaidEmail(updatedOrder);
    await whatsappService.sendCustomerOrderPaidNotification(updatedOrder);
    whatsappService.sendAdminOrderPaidNotification(updatedOrder);
  }
  logger.info(`[Stripe Webhook] Pedido ${updatedOrder.orderNumber} marcado como pagado.`);
  return updatedOrder;
};

const handleStripeWebhook = asyncHandler(async (req, res) => {
  const stripeInstance = getStripeInstance();
  const webhookSecret = getConfig().STRIPE_WEBHOOK_SECRET;

  if (!stripeInstance || !webhookSecret) {
    logger.error('[Stripe Webhook] Stripe no esta configurado completamente.');
    return res.status(500).json({ received: false });
  }

  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    logger.warn(`[Stripe Webhook] Firma invalida: ${error.message}`);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await markStripeOrderPaid(event.data.object);
    } else if (event.type === 'payment_intent.payment_failed') {
      logger.warn('[Stripe Webhook] Pago fallido.', { paymentIntentId: event.data.object.id });
    }
  } catch (error) {
    logger.error(`[Stripe Webhook] Error procesando evento ${event.type}: ${error.message}`);
    return res.status(500).json({ received: false });
  }

  return res.json({ received: true });
});

export { handleStripeWebhook };
