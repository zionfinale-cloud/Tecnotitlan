const toNonNegativeInteger = (value) => Math.max(Math.trunc(Number(value) || 0), 0);

export const getItemAvailableStock = (product = {}) => {
  if (product?.availableStock === null || product?.availabilityMode === 'SUPPLIER_UNLIMITED' || product?.supplierStockUnlimited) {
    return null;
  }

  const availableStock = Number(product?.availableStock);
  if (Number.isFinite(availableStock)) {
    return toNonNegativeInteger(availableStock);
  }

  const ownedStock = toNonNegativeInteger(product?.countInStock);
  if (product?.productType === 'SUPPLIER_ON_DEMAND') {
    return ownedStock + toNonNegativeInteger(product?.supplierStock);
  }

  return ownedStock;
};

export const hasItemAvailability = (product, quantity = 1) => {
  const availableStock = getItemAvailableStock(product);
  return availableStock === null || availableStock >= toNonNegativeInteger(quantity);
};

export const getAvailabilityText = (product = {}) => {
  const availableStock = getItemAvailableStock(product);

  if (availableStock === null) {
    const leadTime = toNonNegativeInteger(product?.supplierLeadTimeMinutes);
    return leadTime > 0
      ? `Disponible bajo pedido (${leadTime} min.)`
      : 'Disponible bajo pedido';
  }

  if (availableStock <= 0) return 'Agotado temporalmente';

  const suffix = product?.productType === 'SUPPLIER_ON_DEMAND' ? ' (proveedor local)' : '';
  return `${availableStock} disponible${availableStock === 1 ? '' : 's'}${suffix}`;
};
