import { BadRequestError } from '../utils/errorUtils.js';

const RESTOCK_REFERENCE_TYPE = 'ORDER_CANCEL';
const RETURN_CONFIRMATION_STATUSES = new Set(['SHIPPED', 'DELIVERED']);
const CHANNEL_STOCK_IN_TYPES = new Set(['CHANNEL_TRANSFER', 'RETURN_IN', 'ADJUSTMENT_IN']);
const CHANNEL_STOCK_OUT_TYPES = new Set(['SALE', 'ADJUSTMENT_OUT', 'RETURN_OUT']);

const hasText = (value) => String(value || '').trim().length > 0;

const getOrderChannel = (order) => order?.salesChannel || 'WEB';

const getAssignedChannelStock = async (tx, productId, channel) => {
  const movements = await tx.inventoryMovement.findMany({
    where: { productId, channel },
    select: { type: true, quantity: true },
    orderBy: { createdAt: 'asc' },
  });

  return movements.reduce((stock, movement) => {
    const quantity = Number(movement.quantity) || 0;
    if (CHANNEL_STOCK_IN_TYPES.has(movement.type)) return stock + quantity;
    if (CHANNEL_STOCK_OUT_TYPES.has(movement.type)) return Math.max(stock - quantity, 0);
    return stock;
  }, 0);
};

const updateMarketplaceStock = async (tx, productId, channel, stockAfter) => {
  if (channel === 'WEB') return;

  await tx.marketplaceListing.upsert({
    where: {
      productId_channel: {
        productId,
        channel,
      },
    },
    update: {
      publishedStock: stockAfter,
      syncStatus: 'local_stock_updated',
      lastSyncedAt: new Date(),
    },
    create: {
      productId,
      channel,
      publishedStock: stockAfter,
      syncStatus: 'local_stock_updated',
      status: 'READY',
    },
  });
};

const getShippingInfo = (order) => (
  order?.shippingInfo && typeof order.shippingInfo === 'object' && !Array.isArray(order.shippingInfo)
    ? order.shippingInfo
    : {}
);

const hasRealShipmentEvidence = (order, status) => {
  const shippingInfo = getShippingInfo(order);
  const hasGuideData = [
    shippingInfo.trackingNumber,
    shippingInfo.guideNumber,
    shippingInfo.guia,
    shippingInfo.trackingUrl,
    shippingInfo.trackingLink,
    shippingInfo.rastreo,
    shippingInfo.carrier,
    shippingInfo.paqueteria,
    shippingInfo.shippingCompany,
  ].some(hasText);

  if (hasGuideData) return true;
  if (status === 'DELIVERED' && order?.deliveredAt) return true;
  return false;
};

const getReturnGateStatus = (order) => {
  if (!order?.status) return null;
  if (order.status !== 'CANCELLED') return order.status;

  const previousStatuses = [...(order.statusHistory || [])]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .filter((entry) => entry.status !== 'CANCELLED');

  return previousStatuses.at(-1)?.status || order.status;
};

export const applyPaidOrderInventoryMovements = async (tx, order, createdById = null) => {
  for (const item of order.orderItems || []) {
    const productType = item.product?.productType;
    if (productType !== 'IN_HOUSE') continue;

    const existingMovement = await tx.inventoryMovement.findFirst({
      where: {
        type: 'SALE',
        productId: item.productId,
        referenceType: 'ORDER',
        referenceId: order.id,
      },
      select: { id: true },
    });

    if (existingMovement) continue;

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        name: true,
        countInStock: true,
        costPrice: true,
        price: true,
      },
    });

    if (!product) {
      throw new BadRequestError(`Producto ${item.name} no encontrado al registrar salida de inventario.`, 400);
    }

    const channel = getOrderChannel(order);
    const stockBefore = channel === 'WEB'
      ? product.countInStock
      : await getAssignedChannelStock(tx, product.id, channel);

    if (stockBefore < item.qty) {
      throw new BadRequestError(
        `Pago confirmado, pero no hay stock suficiente para ${product.name} en ${channel}. Disponible: ${stockBefore}.`,
        409
      );
    }

    const stockAfter = stockBefore - item.qty;
    const unitCost = product.costPrice || item.unitCost || 0;
    const unitPrice = item.price || product.price || 0;

    if (channel === 'WEB') {
      await tx.product.update({
        where: { id: product.id },
        data: { countInStock: stockAfter },
      });
    } else {
      await updateMarketplaceStock(tx, product.id, channel, stockAfter);
    }

    await tx.inventoryMovement.create({
      data: {
        type: 'SALE',
        productId: product.id,
        quantity: item.qty,
        unitCost,
        unitPrice,
        totalCost: item.qty * unitCost,
        totalRevenue: item.qty * unitPrice,
        channel,
        stockBefore,
        stockAfter,
        referenceType: 'ORDER',
        referenceId: order.id,
        notes: `Venta pagada en pedido ${order.orderNumber}`,
        createdById,
      },
    });
  }
};

export const restoreCancelledOrderInventoryMovements = async (tx, order, createdById = null) => {
  if (!order?.id) return { restoredItems: 0, skippedItems: 0, requiresReturnConfirmation: false };

  const returnGateStatus = getReturnGateStatus(order);

  if (
    RETURN_CONFIRMATION_STATUSES.has(returnGateStatus)
    && hasRealShipmentEvidence(order, returnGateStatus)
  ) {
    return { restoredItems: 0, skippedItems: 0, requiresReturnConfirmation: true };
  }

  let restoredItems = 0;
  let skippedItems = 0;

  for (const item of order.orderItems || []) {
    const productType = item.product?.productType;
    if (productType !== 'IN_HOUSE') continue;

    const saleMovement = await tx.inventoryMovement.findFirst({
      where: {
        type: 'SALE',
        productId: item.productId,
        referenceType: 'ORDER',
        referenceId: order.id,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        quantity: true,
        unitCost: true,
        unitPrice: true,
        totalRevenue: true,
        channel: true,
      },
    });

    if (!saleMovement) {
      skippedItems += 1;
      continue;
    }

    const existingReturn = await tx.inventoryMovement.findFirst({
      where: {
        type: 'RETURN_IN',
        productId: item.productId,
        referenceType: RESTOCK_REFERENCE_TYPE,
        referenceId: order.id,
      },
      select: { id: true },
    });

    if (existingReturn) {
      skippedItems += 1;
      continue;
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        name: true,
        countInStock: true,
      },
    });

    if (!product) {
      throw new BadRequestError(`Producto ${item.name} no encontrado al regresar inventario por cancelacion.`, 400);
    }

    const quantity = saleMovement.quantity || item.qty;
    const channel = saleMovement.channel || order.salesChannel || 'WEB';
    const stockBefore = channel === 'WEB'
      ? product.countInStock
      : await getAssignedChannelStock(tx, product.id, channel);
    const stockAfter = stockBefore + quantity;
    const unitCost = saleMovement.unitCost || item.unitCost || 0;
    const unitPrice = saleMovement.unitPrice || item.price || 0;

    if (channel === 'WEB') {
      await tx.product.update({
        where: { id: product.id },
        data: { countInStock: stockAfter },
      });
    } else {
      await updateMarketplaceStock(tx, product.id, channel, stockAfter);
    }

    await tx.inventoryMovement.create({
      data: {
        type: 'RETURN_IN',
        productId: product.id,
        quantity,
        unitCost,
        unitPrice,
        totalCost: quantity * unitCost,
        totalRevenue: saleMovement.totalRevenue || quantity * unitPrice,
        channel,
        stockBefore,
        stockAfter,
        referenceType: RESTOCK_REFERENCE_TYPE,
        referenceId: order.id,
        notes: `Reversa automatica por cancelacion del pedido ${order.orderNumber}`,
        createdById,
      },
    });

    restoredItems += quantity;
  }

  return { restoredItems, skippedItems, requiresReturnConfirmation: false };
};
