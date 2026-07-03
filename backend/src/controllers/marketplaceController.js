import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';

const VALID_CHANNELS = ['WEB', 'MERCADOLIBRE', 'TIKTOK_SHOP', 'AMAZON'];
const VALID_LISTING_STATUSES = ['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ERROR', 'ARCHIVED'];

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const assertChannel = (channel) => {
  if (!VALID_CHANNELS.includes(channel)) {
    throw new BadRequestError('Canal de venta invalido.');
  }
};

const getMarketplaceSummary = asyncHandler(async (req, res) => {
  const [listingsByChannel, ordersByChannel] = await Promise.all([
    prisma.marketplaceListing.groupBy({
      by: ['channel', 'status'],
      _count: { _all: true },
    }),
    prisma.externalOrder.groupBy({
      by: ['channel'],
      _count: { _all: true },
      _sum: { totalPrice: true, netRevenue: true },
    }),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      channels: VALID_CHANNELS,
      listingsByChannel,
      ordersByChannel,
    },
  });
});

const getMarketplaceListings = asyncHandler(async (req, res) => {
  const { channel, status, productId } = req.query;

  if (channel) assertChannel(channel);

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
      ...(productId ? { productId } : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          costPrice: true,
          countInStock: true,
          isArchived: true,
        },
      },
    },
    orderBy: [{ channel: 'asc' }, { updatedAt: 'desc' }],
  });

  res.status(200).json({ status: 'success', data: { listings } });
});

const upsertMarketplaceListing = asyncHandler(async (req, res, next) => {
  const {
    productId,
    channel,
    externalProductId,
    externalSku,
    title,
    price,
    publishedStock,
    stockBuffer,
    commissionRate,
    shippingCostEstimate,
    status,
    notes,
  } = req.body;

  try {
    assertChannel(channel);

    if (status && !VALID_LISTING_STATUSES.includes(status)) {
      throw new BadRequestError('Estado de publicacion invalido.');
    }

    if (!productId) {
      throw new BadRequestError('Producto requerido.');
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Producto no encontrado.');
    }

    const parsedStockBuffer = Number(stockBuffer || 0);
    const parsedPublishedStock =
      publishedStock === undefined || publishedStock === ''
        ? Math.max(product.countInStock - parsedStockBuffer, 0)
        : Number(publishedStock);

    if (!Number.isInteger(parsedPublishedStock) || parsedPublishedStock < 0) {
      throw new BadRequestError('Stock publicado invalido.');
    }

    if (!Number.isInteger(parsedStockBuffer) || parsedStockBuffer < 0) {
      throw new BadRequestError('Buffer de stock invalido.');
    }

    const listing = await prisma.marketplaceListing.upsert({
      where: {
        productId_channel: {
          productId,
          channel,
        },
      },
      create: {
        productId,
        channel,
        externalProductId: externalProductId || null,
        externalSku: externalSku || product.sku,
        title: title || product.name,
        price: parseOptionalNumber(price) ?? product.price,
        publishedStock: parsedPublishedStock,
        stockBuffer: parsedStockBuffer,
        commissionRate: parseOptionalNumber(commissionRate),
        shippingCostEstimate: parseOptionalNumber(shippingCostEstimate),
        status: status || 'DRAFT',
        syncStatus: 'PENDING_SETUP',
        notes,
      },
      update: {
        externalProductId: externalProductId || null,
        externalSku: externalSku || product.sku,
        title: title || product.name,
        price: parseOptionalNumber(price) ?? product.price,
        publishedStock: parsedPublishedStock,
        stockBuffer: parsedStockBuffer,
        commissionRate: parseOptionalNumber(commissionRate),
        shippingCostEstimate: parseOptionalNumber(shippingCostEstimate),
        status: status || 'DRAFT',
        syncStatus: 'PENDING_SYNC',
        notes,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, countInStock: true } },
      },
    });

    res.status(200).json({ status: 'success', data: { listing } });
  } catch (error) {
    next(error);
  }
});

const updateMarketplaceListing = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const {
    externalProductId,
    externalSku,
    title,
    price,
    publishedStock,
    stockBuffer,
    commissionRate,
    shippingCostEstimate,
    status,
    syncStatus,
    notes,
  } = req.body;

  try {
    if (status && !VALID_LISTING_STATUSES.includes(status)) {
      throw new BadRequestError('Estado de publicacion invalido.');
    }

    const current = await prisma.marketplaceListing.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('Publicacion no encontrada.');
    }

    const data = {
      ...(externalProductId !== undefined ? { externalProductId: externalProductId || null } : {}),
      ...(externalSku !== undefined ? { externalSku: externalSku || null } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(price !== undefined ? { price: parseOptionalNumber(price) } : {}),
      ...(publishedStock !== undefined ? { publishedStock: Number(publishedStock) } : {}),
      ...(stockBuffer !== undefined ? { stockBuffer: Number(stockBuffer) } : {}),
      ...(commissionRate !== undefined ? { commissionRate: parseOptionalNumber(commissionRate) } : {}),
      ...(shippingCostEstimate !== undefined ? { shippingCostEstimate: parseOptionalNumber(shippingCostEstimate) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(syncStatus !== undefined ? { syncStatus } : {}),
      ...(notes !== undefined ? { notes } : {}),
    };

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, sku: true, name: true, countInStock: true } },
      },
    });

    res.status(200).json({ status: 'success', data: { listing } });
  } catch (error) {
    next(error);
  }
});

const archiveMarketplaceListing = asyncHandler(async (req, res) => {
  const listing = await prisma.marketplaceListing.update({
    where: { id: req.params.id },
    data: { status: 'ARCHIVED', syncStatus: 'ARCHIVED_LOCAL' },
  });

  res.status(200).json({ status: 'success', data: { listing } });
});

const getExternalOrders = asyncHandler(async (req, res) => {
  const { channel, externalStatus } = req.query;
  if (channel) assertChannel(channel);

  const externalOrders = await prisma.externalOrder.findMany({
    where: {
      ...(channel ? { channel } : {}),
      ...(externalStatus ? { externalStatus } : {}),
    },
    include: {
      order: { select: { id: true, orderNumber: true, status: true, totalPrice: true } },
    },
    orderBy: { importedAt: 'desc' },
    take: Number(req.query.limit) || 100,
  });

  res.status(200).json({ status: 'success', data: { externalOrders } });
});

const createExternalOrder = asyncHandler(async (req, res, next) => {
  const {
    channel,
    externalOrderId,
    externalStatus,
    customerName,
    totalPrice,
    shippingPrice,
    feesEstimated,
    orderedAt,
    orderId,
  } = req.body;

  try {
    assertChannel(channel);

    if (!externalOrderId) {
      throw new BadRequestError('ID externo de orden requerido.');
    }

    const total = Number(totalPrice || 0);
    const shipping = Number(shippingPrice || 0);
    const fees = Number(feesEstimated || 0);

    const externalOrder = await prisma.externalOrder.upsert({
      where: {
        channel_externalOrderId: {
          channel,
          externalOrderId,
        },
      },
      create: {
        channel,
        externalOrderId,
        externalStatus: externalStatus || 'IMPORTED',
        customerName,
        totalPrice: total,
        shippingPrice: shipping,
        feesEstimated: fees,
        netRevenue: total - shipping - fees,
        orderedAt: orderedAt ? new Date(orderedAt) : null,
        orderId: orderId || null,
      },
      update: {
        externalStatus: externalStatus || 'IMPORTED',
        customerName,
        totalPrice: total,
        shippingPrice: shipping,
        feesEstimated: fees,
        netRevenue: total - shipping - fees,
        orderedAt: orderedAt ? new Date(orderedAt) : null,
        orderId: orderId || null,
      },
    });

    res.status(201).json({ status: 'success', data: { externalOrder } });
  } catch (error) {
    next(error);
  }
});

export {
  archiveMarketplaceListing,
  createExternalOrder,
  getExternalOrders,
  getMarketplaceListings,
  getMarketplaceSummary,
  updateMarketplaceListing,
  upsertMarketplaceListing,
};
