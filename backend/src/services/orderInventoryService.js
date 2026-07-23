import { BadRequestError } from '../utils/errorUtils.js';

const RESTOCK_REFERENCE_TYPE = 'ORDER_CANCEL';
const RETURN_CONFIRMATION_STATUSES = new Set(['SHIPPED', 'DELIVERED']);

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

    if (product.countInStock < item.qty) {
      throw new BadRequestError(
        `Pago confirmado, pero no hay stock suficiente para ${product.name}. Disponible: ${product.countInStock}.`,
        409
      );
    }

    const stockBefore = product.countInStock;
    const stockAfter = stockBefore - item.qty;
    const unitCost = product.costPrice || item.unitCost || 0;
    const unitPrice = item.price || product.price || 0;

    await tx.product.update({
      where: { id: product.id },
      data: { countInStock: stockAfter },
    });

    await tx.inventoryMovement.create({
      data: {
        type: 'SALE',
        productId: product.id,
        quantity: item.qty,
        unitCost,
        unitPrice,
        totalCost: item.qty * unitCost,
        totalRevenue: item.qty * unitPrice,
        channel: 'WEB',
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

  if (RETURN_CONFIRMATION_STATUSES.has(returnGateStatus)) {
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
    const stockBefore = product.countInStock;
    const stockAfter = stockBefore + quantity;
    const unitCost = saleMovement.unitCost || item.unitCost || 0;
    const unitPrice = saleMovement.unitPrice || item.price || 0;

    await tx.product.update({
      where: { id: product.id },
      data: { countInStock: stockAfter },
    });

    await tx.inventoryMovement.create({
      data: {
        type: 'RETURN_IN',
        productId: product.id,
        quantity,
        unitCost,
        unitPrice,
        totalCost: quantity * unitCost,
        totalRevenue: saleMovement.totalRevenue || quantity * unitPrice,
        channel: saleMovement.channel || order.salesChannel || 'WEB',
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
