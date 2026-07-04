import { BadRequestError } from '../utils/errorUtils.js';

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
