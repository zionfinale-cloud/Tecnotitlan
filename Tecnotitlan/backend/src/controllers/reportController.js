// d:\PowerUpMovil\backend\src\controllers\reportController.js
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import asyncHandler from 'express-async-handler';

/**
 * @desc    Obtener resumen de ventas, con filtros de fecha opcionales.
 * @route   GET /api/reports/sales-summary
 * @access  Private/Admin
 * @query   startDate (opcional, formato YYYY-MM-DD)
 * @query   endDate (opcional, formato YYYY-MM-DD)
 */
const getSalesSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Construir el filtro de fecha
  const dateFilter = { isPaid: true };
  if (startDate && endDate) {
    // Asegurarse que el endDate incluya todo el día
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    dateFilter.paidAt = { // Prisma usa la misma sintaxis para rangos
      gte: new Date(startDate),
      lte: endOfDay,
    };
  }

  const paidOrders = await prisma.order.findMany({ where: dateFilter });

  const totalSales = paidOrders.reduce((acc, order) => acc + order.totalPrice, 0);
  const numberOfOrders = paidOrders.length;

  res.status(200).json({
    status: 'success',
    data: {
      totalSales,
      numberOfOrders,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    },
  });
});

/**
 * @desc    Obtener reporte de ganancias (ventas vs costos).
 * @route   GET /api/reports/profit-summary
 * @access  Private/Admin
 * @query   startDate (opcional, formato YYYY-MM-DD)
 * @query   endDate (opcional, formato YYYY-MM-DD)
 */
const getProfitReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // 1. Construir el filtro de fecha para los pedidos pagados
  const dateFilter = { isPaid: true };
  if (startDate && endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    dateFilter.paidAt = {
      gte: new Date(startDate),
      lte: endOfDay,
    };
  }

  // En Prisma, esto se hace obteniendo los datos y procesándolos en la aplicación.
  // Las agregaciones complejas a veces requieren consultas raw.
  const orders = await prisma.order.findMany({
    where: dateFilter,
    include: {
      orderItems: {
        include: {
          product: {
            select: { costPrice: true },
          },
        },
      },
    },
  });

  let totalSales = 0;
  let totalCosts = 0;

  orders.forEach(order => {
    order.orderItems.forEach(item => {
      const sale = item.qty * item.price;
      const cost = item.qty * (item.product.costPrice || 0);
      totalSales += sale;
      totalCosts += cost;
    });
  });

  const totalProfit = totalSales - totalCosts;
  const numberOfOrders = orders.length;

  const profitData = {
    totalSales,
    totalCosts,
    totalProfit,
    numberOfOrders,
  };

  if (numberOfOrders === 0) {
    return res.status(200).json({
      status: 'success',
      data: {
        totalSales: 0,
        totalCosts: 0,
        totalProfit: 0,
        numberOfOrders: 0,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      ...profitData,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    },
  });
});

/**
 * @desc    Obtener los productos más vendidos.
 * @route   GET /api/reports/top-selling-products
 * @access  Private/Admin
 */
const getTopSellingProducts = asyncHandler(async (req, res) => {
  // Usando `groupBy` de Prisma
  const topItems = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { order: { isPaid: true } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: 'desc' } },
    take: 10,
  });

  const productIds = topItems.map(item => item.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true },
  });

  const productMap = products.reduce((map, p) => {
    map[p.id] = p;
    return map;
  }, {});

  const topProducts = topItems.map(item => ({
    productId: item.productId,
    totalQuantitySold: item._sum.qty,
    productName: productMap[item.productId]?.name,
    productSku: productMap[item.productId]?.sku,
  }));

  res.status(200).json({
    status: 'success',
    data: topProducts,
  });
});

/**
 * @desc    Obtener un reporte de los niveles de stock de todos los productos.
 * @route   GET /api/reports/stock-levels
 * @access  Private/Admin
 */
const getStockLevels = asyncHandler(async (req, res) => {
  const stockLevels = await prisma.product.findMany({
    select: { name: true, sku: true, countInStock: true },
    orderBy: { countInStock: 'asc' },
  });

  res.status(200).json({
    status: 'success',
    data: stockLevels,
  });
});

/**
 * @desc    Obtener productos con bajo nivel de stock según un umbral.
 * @route   GET /api/reports/low-stock
 * @access  Private/Admin
 */
const getLowStockReport = asyncHandler(async (req, res) => {
  const threshold = Number(req.query.threshold) || 10;
  const lowStockProducts = await prisma.product.findMany({
    where: { countInStock: { lte: threshold } },
    select: { name: true, sku: true, countInStock: true },
    orderBy: { countInStock: 'asc' },
  });

  res.status(200).json({
    status: 'success',
    data: lowStockProducts,
  });
});

export {
  getSalesSummary,
  getProfitReport,
  getTopSellingProducts,
  getStockLevels,
  getLowStockReport,
};