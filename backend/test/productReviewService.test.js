import test from 'node:test';
import assert from 'node:assert/strict';
import { hasEligiblePurchaseForReview } from '../src/services/productReviewService.js';

test('allows reviews for a paid, non-cancelled purchase of the product', async () => {
  let receivedQuery;
  const prismaClient = {
    order: {
      findFirst: async (query) => {
        receivedQuery = query;
        return { id: 'order-1' };
      },
    },
  };

  const result = await hasEligiblePurchaseForReview({
    prismaClient,
    userId: 'user-1',
    productId: 'product-1',
  });

  assert.equal(result, true);
  assert.deepEqual(receivedQuery, {
    where: {
      userId: 'user-1',
      isPaid: true,
      status: { not: 'CANCELLED' },
      orderItems: { some: { productId: 'product-1' } },
    },
    select: { id: true },
  });
});

test('rejects reviews when no eligible purchase exists', async () => {
  const prismaClient = {
    order: { findFirst: async () => null },
  };

  const result = await hasEligiblePurchaseForReview({
    prismaClient,
    userId: 'user-1',
    productId: 'product-1',
  });

  assert.equal(result, false);
});

test('does not query the database with incomplete identifiers', async () => {
  let queried = false;
  const prismaClient = {
    order: {
      findFirst: async () => {
        queried = true;
        return { id: 'order-1' };
      },
    },
  };

  const result = await hasEligiblePurchaseForReview({
    prismaClient,
    userId: '',
    productId: 'product-1',
  });

  assert.equal(result, false);
  assert.equal(queried, false);
});
