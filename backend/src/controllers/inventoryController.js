import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';

const toDateRange = (startDate, endDate) => {
  const filter = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return Object.keys(filter).length ? filter : undefined;
};

const getInvestments = asyncHandler(async (req, res) => {
  const investments = await prisma.inventoryInvestment.findMany({
    include: {
      movements: { select: { totalCost: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = investments.map((investment) => {
    const spent = investment.movements.reduce((sum, movement) => sum + movement.totalCost, 0);
    return {
      id: investment.id,
      name: investment.name,
      amount: investment.amount,
      spent,
      remaining: investment.amount - spent,
      notes: investment.notes,
      createdAt: investment.createdAt,
      updatedAt: investment.updatedAt,
    };
  });

  res.status(200).json({ status: 'success', data: { investments: data } });
});

const createInvestment = asyncHandler(async (req, res, next) => {
  const { name, amount, notes } = req.body;
  const parsedAmount = Number(amount);

  if (!name || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return next(new BadRequestError('Nombre y monto de inversión válido son requeridos.'));
  }

  const investment = await prisma.inventoryInvestment.create({
    data: {
      name: name.trim(),
      amount: parsedAmount,
      notes,
      createdById: req.user?.id,
    },
  });

  res.status(201).json({ status: 'success', data: { investment } });
});

const createStockEntry = asyncHandler(async (req, res, next) => {
  const { productId, sku, quantity, unitCost, investmentId, notes } = req.body;
  const parsedQuantity = Number(quantity);
  const parsedUnitCost = Number(unitCost);

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return next(new BadRequestError('La cantidad debe ser un entero mayor a cero.'));
  }

  if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) {
    return next(new BadRequestError('El costo unitario debe ser un número válido.'));
  }

  const movement = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: productId ? { id: productId } : { sku: String(sku || '').toUpperCase() },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado.');
    }

    if (investmentId) {
      const investment = await tx.inventoryInvestment.findUnique({
        where: { id: investmentId },
        include: { movements: { select: { totalCost: true } } },
      });

      if (!investment) {
        throw new NotFoundError('Inversión no encontrada.');
      }

      const spent = investment.movements.reduce((sum, item) => sum + item.totalCost, 0);
      const totalEntryCost = parsedQuantity * parsedUnitCost;
      if (spent + totalEntryCost > investment.amount) {
        throw new BadRequestError('La entrada excede el monto disponible de la inversión.');
      }
    }

    const stockBefore = product.countInStock;
    const stockAfter = stockBefore + parsedQuantity;
    const currentStockValue = stockBefore * (product.costPrice || 0);
    const entryCost = parsedQuantity * parsedUnitCost;
    const weightedCost = stockAfter > 0 ? (currentStockValue + entryCost) / stockAfter : parsedUnitCost;

    await tx.product.update({
      where: { id: product.id },
      data: {
        countInStock: stockAfter,
        costPrice: weightedCost,
      },
    });

    return tx.inventoryMovement.create({
      data: {
        type: 'PURCHASE',
        productId: product.id,
        investmentId: investmentId || null,
        quantity: parsedQuantity,
        unitCost: parsedUnitCost,
        totalCost: entryCost,
        stockBefore,
        stockAfter,
        referenceType: 'MANUAL_PURCHASE',
        notes,
        createdById: req.user?.id,
      },
      include: { product: { select: { id: true, sku: true, name: true } }, investment: true },
    });
  });

  res.status(201).json({ status: 'success', data: { movement } });
});

const getMovements = asyncHandler(async (req, res) => {
  const { startDate, endDate, productId, type } = req.query;
  const createdAt = toDateRange(startDate, endDate);

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      ...(createdAt ? { createdAt } : {}),
      ...(productId ? { productId } : {}),
      ...(type ? { type } : {}),
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      investment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Number(req.query.limit) || 100,
  });

  res.status(200).json({ status: 'success', data: { movements } });
});

const getInventoryCut = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const createdAt = toDateRange(startDate, endDate);

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      ...(createdAt ? { createdAt } : {}),
      type: { in: ['SALE', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT'] },
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const summary = {
    investedInPeriod: 0,
    salesRevenue: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    unitsPurchased: 0,
    unitsSold: 0,
    products: {},
    filters: { startDate: startDate || null, endDate: endDate || null },
  };

  for (const movement of movements) {
    const productKey = movement.productId;
    if (!summary.products[productKey]) {
      summary.products[productKey] = {
        productId: movement.productId,
        sku: movement.product.sku,
        name: movement.product.name,
        unitsPurchased: 0,
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
    }

    const row = summary.products[productKey];

    if (movement.type === 'PURCHASE' || movement.type === 'ADJUSTMENT_IN') {
      summary.investedInPeriod += movement.totalCost;
      summary.unitsPurchased += movement.quantity;
      row.unitsPurchased += movement.quantity;
    }

    if (movement.type === 'SALE') {
      const revenue = movement.totalRevenue || 0;
      summary.salesRevenue += revenue;
      summary.costOfGoodsSold += movement.totalCost;
      summary.unitsSold += movement.quantity;
      row.unitsSold += movement.quantity;
      row.revenue += revenue;
      row.cost += movement.totalCost;
      row.profit += revenue - movement.totalCost;
    }
  }

  summary.grossProfit = summary.salesRevenue - summary.costOfGoodsSold;

  res.status(200).json({
    status: 'success',
    data: {
      ...summary,
      products: Object.values(summary.products),
    },
  });
});

export {
  getInvestments,
  createInvestment,
  createStockEntry,
  getMovements,
  getInventoryCut,
};
