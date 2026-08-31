import assert from 'node:assert/strict';
import test from 'node:test';
import { findMeliOrderByShipment, getMeliClaimOutcome } from '../src/utils/meliClaimOutcome.js';

test('vincula reclamos referidos por shipment con su pedido local', () => {
  const expected = { id: 'order-1', shippingInfo: { shippingId: 47874166286 } };
  assert.equal(findMeliOrderByShipment([expected], '47874166286'), expected);
  assert.equal(findMeliOrderByShipment([expected], 'otro-envio'), null);
});

test('explica un reclamo cerrado a favor del comprador con cobertura y cancelacion', () => {
  const outcome = getMeliClaimOutcome({
    status: 'closed',
    rawData: { resolution: { reason: 'coverage_decision', benefited: ['complainant'], closed_by: 'mediator', applied_coverage: true, date_created: '2026-08-30T22:47:52-04:00' } },
    order: {
      orderNumber: 'MELI-2000018155463682', status: 'CANCELLED', isPaid: false,
      externalOrders: [{ channel: 'MERCADOLIBRE', rawData: { currency_id: 'MXN', payments: [{ status: 'refunded', transaction_amount: 1070.75, date_last_modified: '2026-08-30T22:51:51-04:00' }] } }],
    },
  });
  assert.equal(outcome.headline, 'Reclamo cerrado a favor del comprador');
  assert.match(outcome.summary, /aplicó cobertura/i);
  assert.match(outcome.summary, /quedó cancelado/i);
  assert.match(outcome.summary, /reembolso de \$1,070\.75/i);
  assert.equal(outcome.refunded, true);
});

test('usa el historial cuando Mercado Libre no envia objeto de resolucion', () => {
  const outcome = getMeliClaimOutcome({ status: 'closed', historyData: [{ status: 'closed', change_by: 'mediator', date: '2026-08-30T22:47:52-04:00' }] });
  assert.equal(outcome.headline, 'Reclamo cerrado por Mercado Libre');
  assert.equal(outcome.at, '2026-08-30T22:47:52-04:00');
});

test('no inventa desenlace para un reclamo abierto', () => {
  assert.equal(getMeliClaimOutcome({ status: 'opened' }), null);
});
