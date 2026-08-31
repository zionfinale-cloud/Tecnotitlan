import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCriticalClaimAlerts } from '../src/utils/criticalInboxAlerts.js';

test('mantiene visible un reclamo abierto hasta que alguien lo revisa', () => {
  const claim = { externalClaimId: '10', status: 'opened', title: 'Producto no recibido', activities: [] };
  assert.equal(buildCriticalClaimAlerts(claim)[0].kind, 'CLAIM');
  claim.activities.push({ action: 'DASHBOARD_ALERT_ACKNOWLEDGED', details: { alertKind: 'CLAIM' } });
  assert.equal(buildCriticalClaimAlerts(claim).length, 0);
});

test('genera una alerta independiente cuando el reembolso fue confirmado', () => {
  const claim = {
    externalClaimId: '11', status: 'closed', activities: [],
    rawData: { resolution: { benefited: ['complainant'], reason: 'refunded', date_created: '2026-08-31T12:00:00Z' } },
    order: { orderNumber: 'MELI-11', status: 'CANCELLED', externalOrders: [{ channel: 'MERCADOLIBRE', rawData: { payments: [{ status: 'refunded', transaction_amount: 500, currency_id: 'MXN' }] } }] },
  };
  const alert = buildCriticalClaimAlerts(claim)[0];
  assert.equal(alert.kind, 'REFUND');
  assert.match(alert.message, /\$500\.00/);
});

test('el acuse de reclamo no oculta una alerta posterior de reembolso', () => {
  const claim = {
    externalClaimId: '12', status: 'closed',
    activities: [{ action: 'DASHBOARD_ALERT_ACKNOWLEDGED', details: { alertKind: 'CLAIM' } }],
    rawData: { resolution: { benefited: ['complainant'], reason: 'refunded', date_created: '2026-08-31T12:00:00Z' } },
    order: { status: 'CANCELLED', externalOrders: [{ rawData: { payments: [{ status: 'refunded', transaction_amount: 100 }] } }] },
  };
  assert.deepEqual(buildCriticalClaimAlerts(claim).map((alert) => alert.kind), ['REFUND']);
});
