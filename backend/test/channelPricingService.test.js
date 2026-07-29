import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateChannelPrice,
  normalizeCommissionRate,
  resolveMarketplacePrice,
} from '../src/services/channelPricingService.js';

test('normalizes percentage commission values', () => {
  assert.equal(normalizeCommissionRate(17), 0.17);
  assert.equal(normalizeCommissionRate(0.17), 0.17);
});

test('raises the marketplace price to preserve the target net revenue', () => {
  const result = calculateChannelPrice({
    baseNetPrice: 350,
    commissionRate: 17,
    fixedFee: 25,
    shippingCostEstimate: 50,
  });

  assert.equal(result.price, 512.05);
  assert.equal(result.expectedNet, 350);
});

test('respects a manual marketplace price when automatic pricing is disabled', () => {
  const result = resolveMarketplacePrice({
    product: { price: 350 },
    listing: {
      autoPrice: false,
      price: 499,
      commissionRate: 17,
      fixedFee: 0,
      shippingCostEstimate: 0,
    },
  });

  assert.equal(result.price, 499);
  assert.equal(result.automatic, false);
});
