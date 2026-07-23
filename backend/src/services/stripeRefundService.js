import Stripe from 'stripe';
import prisma from '../config/prisma.js';
import { getConfig } from './configService.js';
import logger from '../utils/logger.js';

let stripe;

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const getStripeInstance = () => {
  if (!stripe) {
    const secretKey = getConfig().STRIPE_SECRET_KEY;
    if (secretKey) stripe = new Stripe(secretKey);
  }
  return stripe;
};

const toPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const getPaymentIntentId = (order) => {
  const paymentResult = toPlainObject(order?.paymentResult);
  const candidates = [
    paymentResult.id,
    paymentResult.paymentIntentId,
    paymentResult.payment_intent,
    paymentResult.paymentIntent?.id,
  ].filter(Boolean).map(String);

  return candidates.find((candidate) => candidate.startsWith('pi_')) || null;
};

const hasRefundRecorded = (order) => {
  const paymentResult = toPlainObject(order?.paymentResult);
  return Boolean(paymentResult.refund?.id || paymentResult.refundStatus);
};

const hasShipmentEvidence = (order) => {
  const shippingInfo = toPlainObject(order?.shippingInfo);
  return Boolean(
    ['SHIPPED', 'DELIVERED'].includes(order?.status)
    || order?.shippedAt
    || order?.deliveredAt
    || shippingInfo.trackingNumber
    || shippingInfo.guideNumber
    || shippingInfo.guia
    || shippingInfo.carrier
    || shippingInfo.trackingUrl
  );
};

const appendCancellationHistory = (orderId, notes) => prisma.statusHistory.create({
  data: {
    orderId,
    status: 'CANCELLED',
    notes,
  },
});

export const refundStripeOrderIfEligible = async (order) => {
  const orderNumber = order?.orderNumber || order?.id || 'sin folio';

  if (!order?.isPaid) {
    return {
      status: 'SKIPPED',
      customerNote: 'El pedido no tenia pago confirmado, asi que no fue necesario generar reembolso.',
    };
  }

  if (order.paymentMethod !== 'Stripe') {
    return {
      status: 'SKIPPED',
      customerNote: 'El pedido se cancelo. Si el pago fue manual, el equipo Tecnotitlan revisara la devolucion correspondiente.',
    };
  }

  if (hasRefundRecorded(order)) {
    return {
      status: 'SKIPPED',
      customerNote: 'Este pedido ya tenia un reembolso registrado.',
    };
  }

  if (hasShipmentEvidence(order)) {
    const note = 'Pedido cancelado. El reembolso queda pendiente de revision porque el pedido ya tenia evidencia de envio.';
    await appendCancellationHistory(order.id, note);
    return {
      status: 'PENDING_REVIEW',
      customerNote: note,
    };
  }

  const paymentIntentId = getPaymentIntentId(order);
  if (!paymentIntentId) {
    const note = 'Pedido cancelado. No se encontro el Payment Intent de Stripe; el reembolso requiere revision manual.';
    await appendCancellationHistory(order.id, note);
    return {
      status: 'PENDING_REVIEW',
      customerNote: note,
    };
  }

  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    const note = 'Pedido cancelado. Stripe no esta configurado para procesar el reembolso automatico.';
    await appendCancellationHistory(order.id, note);
    return {
      status: 'FAILED',
      customerNote: note,
    };
  }

  try {
    const refund = await stripeInstance.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        order_id: order.orderNumber || '',
        order_uuid: order.id || '',
      },
    });

    const paymentResult = toPlainObject(order.paymentResult);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentResult: {
          ...paymentResult,
          refund: {
            id: refund.id,
            status: refund.status,
            amount: refund.amount,
            currency: refund.currency,
            created: refund.created,
            payment_intent: paymentIntentId,
          },
          refundStatus: refund.status,
          refundedAt: new Date().toISOString(),
        },
      },
    });

    const amount = currency.format((refund.amount || Math.round(Number(order.totalPrice || 0) * 100)) / 100);
    const note = `Reembolso solicitado en Stripe por ${amount}. Puede tardar unos dias habiles en verse reflejado segun el banco.`;
    await appendCancellationHistory(order.id, note);
    logger.info(`[Stripe Refund] Reembolso ${refund.id} solicitado para ${orderNumber}.`);

    return {
      status: 'REFUNDED',
      refund,
      customerNote: note,
    };
  } catch (error) {
    const note = `Pedido cancelado. No se pudo iniciar el reembolso automatico en Stripe: ${error.message}`;
    await appendCancellationHistory(order.id, note);
    logger.error(`[Stripe Refund] Error reembolsando ${orderNumber}: ${error.message}`);
    return {
      status: 'FAILED',
      customerNote: note,
      error,
    };
  }
};
