import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultMarketplaceOfferStock,
  getProductAvailableStock,
  hasProductAvailability,
} from '../src/utils/productAvailability.js';

test('keeps owned stock separate for in-house products', () => {
  const product = { productType: 'IN_HOUSE', countInStock: 3, supplierStock: 50 };
  assert.equal(getProductAvailableStock(product), 3);
});

test('adds finite supplier availability for on-demand products', () => {
  const product = {
    productType: 'SUPPLIER_ON_DEMAND',
    countInStock: 2,
    supplierStock: 20,
    supplierStockUnlimited: false,
  };

  assert.equal(getProductAvailableStock(product), 22);
  assert.equal(hasProductAvailability(product, 22), true);
  assert.equal(hasProductAvailability(product, 23), false);
});

test('uses a controlled offer for unlimited supplier availability', () => {
  const product = {
    productType: 'SUPPLIER_ON_DEMAND',
    countInStock: 0,
    supplierStockUnlimited: true,
  };

  assert.equal(getProductAvailableStock(product), null);
  assert.equal(hasProductAvailability(product, 500), true);
  assert.equal(getDefaultMarketplaceOfferStock(product, 2, 10), 8);
});
