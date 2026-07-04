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

const SALES_CHANNELS = ['MERCADOLIBRE', 'TIKTOK_SHOP', 'AMAZON'];

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

const transferStockToChannel = asyncHandler(async (req, res, next) => {
  const { productId, channel, quantity, price, stockBuffer, notes } = req.body;
  const parsedQuantity = Number(quantity);
  const parsedPrice = price === undefined || price === '' ? null : Number(price);
  const parsedStockBuffer = Number(stockBuffer || 0);

  if (!SALES_CHANNELS.includes(channel)) {
    return next(new BadRequestError('Canal de destino invalido.'));
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return next(new BadRequestError('La cantidad debe ser un entero mayor a cero.'));
  }

  if (!Number.isInteger(parsedStockBuffer) || parsedStockBuffer < 0) {
    return next(new BadRequestError('El buffer debe ser un entero no negativo.'));
  }

  if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
    return next(new BadRequestError('El precio de canal debe ser valido.'));
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Producto no encontrado.');
    }

    if (product.countInStock < parsedQuantity) {
      throw new BadRequestError('No hay suficiente stock en bodega/web para mover a ese canal.');
    }

    const stockBefore = product.countInStock;
    const stockAfter = stockBefore - parsedQuantity;

    await tx.product.update({
      where: { id: product.id },
      data: { countInStock: stockAfter },
    });

    const existingListing = await tx.marketplaceListing.findUnique({
      where: { productId_channel: { productId: product.id, channel } },
    });

    const nextPublishedStock = (existingListing?.publishedStock || 0) + parsedQuantity;

    const listing = existingListing
      ? await tx.marketplaceListing.update({
          where: { id: existingListing.id },
          data: {
            publishedStock: nextPublishedStock,
            stockBuffer: parsedStockBuffer,
            price: parsedPrice ?? existingListing.price ?? product.price,
            syncStatus: 'LOCAL_STOCK_UPDATED',
          },
        })
      : await tx.marketplaceListing.create({
          data: {
            productId: product.id,
            channel,
            externalSku: product.sku,
            title: product.name,
            price: parsedPrice ?? product.price,
            publishedStock: nextPublishedStock,
            stockBuffer: parsedStockBuffer,
            status: 'DRAFT',
            syncStatus: 'LOCAL_STOCK_ASSIGNED',
          },
        });

    const movement = await tx.inventoryMovement.create({
      data: {
        type: 'CHANNEL_TRANSFER',
        productId: product.id,
        quantity: parsedQuantity,
        unitCost: product.costPrice || 0,
        totalCost: parsedQuantity * (product.costPrice || 0),
        channel,
        stockBefore,
        stockAfter,
        referenceType: 'CHANNEL_STOCK_TRANSFER',
        referenceId: listing.id,
        notes,
        createdById: req.user?.id,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    return { movement, listing };
  });

  res.status(201).json({ status: 'success', data: result });
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

const getInventoryOverview = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isArchived: false },
    include: {
      category: { select: { name: true } },
      marketplaceListings: {
        where: { status: { not: 'ARCHIVED' } },
        select: {
          channel: true,
          publishedStock: true,
          stockBuffer: true,
          price: true,
          status: true,
        },
      },
    },
    orderBy: { sku: 'asc' },
  });

  const rows = products.map((product) => {
    const channelStock = {
      WEB: product.countInStock,
      MERCADOLIBRE: 0,
      TIKTOK_SHOP: 0,
      AMAZON: 0,
    };

    const channelPrices = {};
    const channelStatuses = {};

    for (const listing of product.marketplaceListings) {
      channelStock[listing.channel] = listing.publishedStock || 0;
      channelPrices[listing.channel] = listing.price || null;
      channelStatuses[listing.channel] = listing.status;
    }

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      category: product.category?.name || null,
      totalPhysicalStock: product.countInStock,
      costPrice: product.costPrice || 0,
      webPrice: product.price,
      channelStock,
      channelPrices,
      channelStatuses,
      reorderSuggested: product.countInStock <= 3,
    };
  });

  res.status(200).json({ status: 'success', data: { inventory: rows } });
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
    salesByChannel: {},
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
      const channel = movement.channel || 'WEB';
      summary.salesRevenue += revenue;
      summary.costOfGoodsSold += movement.totalCost;
      summary.unitsSold += movement.quantity;
      if (!summary.salesByChannel[channel]) {
        summary.salesByChannel[channel] = { channel, unitsSold: 0, revenue: 0, cost: 0, profit: 0 };
      }
      summary.salesByChannel[channel].unitsSold += movement.quantity;
      summary.salesByChannel[channel].revenue += revenue;
      summary.salesByChannel[channel].cost += movement.totalCost;
      summary.salesByChannel[channel].profit += revenue - movement.totalCost;
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
      salesByChannel: Object.values(summary.salesByChannel),
      products: Object.values(summary.products),
    },
  });
});

export {
  getInvestments,
  getInventoryOverview,
  createInvestment,
  createStockEntry,
  transferStockToChannel,
  getMovements,
  getInventoryCut,
};
