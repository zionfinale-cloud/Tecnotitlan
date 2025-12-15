import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { getConfig } from '../services/configService.js';
import { BadRequestError } from '../utils/errorUtils.js';

// Asumimos que podrías usar Stripe para reportes financieros.
import Stripe from 'stripe';

/**
 * @desc    Genera un reporte de ventas en un rango de fechas.
 * @route   GET /api/reports/sales
 * @access  Private/Admin
 */
export const generateSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new BadRequestError('Por favor, proporcione una fecha de inicio y una fecha de fin.');
  }

  // 1. Obtener órdenes completadas desde la base de datos
  const orders = await prisma.order.findMany({
    where: {
      status: 'Completed',
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: {
      orderItems: true,
    },
  });

  // 2. Calcular totales
  const totalSales = orders.reduce((acc, order) => acc + order.totalPrice, 0);
  const totalOrders = orders.length;

  // 3. (Ejemplo) Obtener balance de Stripe usando la clave desde configService
  const config = getConfig();
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const balance = await stripe.balance.retrieve();

  res.json({
    totalSales,
    totalOrders,
    stripeBalance: {
      available: balance.available.map(b => ({ amount: b.amount / 100, currency: b.currency })),
      pending: balance.pending.map(b => ({ amount: b.amount / 100, currency: b.currency })),
    },
    orders,
  });
});