export const isSupplierOnDemand = (product) =>
  product?.productType === 'SUPPLIER_ON_DEMAND';

const nonNegativeInteger = (value) =>
  Math.max(Math.trunc(Number(value) || 0), 0);

export const getProductAvailableStock = (product) => {
  const ownedStock = nonNegativeInteger(product?.countInStock);

  if (!isSupplierOnDemand(product)) {
    return ownedStock;
  }

  if (product?.supplierStockUnlimited) {
    return null;
  }

  return ownedStock + nonNegativeInteger(product?.supplierStock);
};

export const hasProductAvailability = (product, quantity) => {
  const availableStock = getProductAvailableStock(product);
  return availableStock === null || availableStock >= nonNegativeInteger(quantity);
};

export const getDefaultMarketplaceOfferStock = (
  product,
  stockBuffer = 0,
  unlimitedSupplierOffer = 10,
) => {
  const availableStock = getProductAvailableStock(product);
  const buffer = nonNegativeInteger(stockBuffer);

  if (availableStock === null) {
    return Math.max(nonNegativeInteger(unlimitedSupplierOffer) - buffer, 0);
  }

  return Math.max(availableStock - buffer, 0);
};

export const decorateProductAvailability = (product) => ({
  ...product,
  availableStock: getProductAvailableStock(product),
  availabilityMode: isSupplierOnDemand(product)
    ? (product.supplierStockUnlimited ? 'SUPPLIER_UNLIMITED' : 'SUPPLIER_STOCK')
    : 'OWNED_STOCK',
});
