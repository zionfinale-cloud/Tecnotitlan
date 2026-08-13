import test from 'node:test';
import assert from 'node:assert/strict';

import { getPublishableStock } from '../src/services/channelStockSyncService.js';

test('publishes assigned Mercado Libre stock minus the safety buffer', () => {
  assert.equal(getPublishableStock({ publishedStock: 10, stockBuffer: 2 }), 8);
});

test('never publishes negative stock when the buffer exceeds assigned stock', () => {
  assert.equal(getPublishableStock({ publishedStock: 3, stockBuffer: 5 }), 0);
});

test('normalizes missing, negative, or invalid stock values', () => {
  assert.equal(getPublishableStock(), 0);
  assert.equal(getPublishableStock({ publishedStock: -4, stockBuffer: 1 }), 0);
  assert.equal(getPublishableStock({ publishedStock: 'invalid', stockBuffer: 1 }), 0);
});
