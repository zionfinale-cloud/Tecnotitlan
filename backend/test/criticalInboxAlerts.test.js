import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCriticalClaimAlerts, buildRefundReconciliation, getCriticalEscalationLevel } from '../src/utils/criticalInboxAlerts.js';

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

test('concilia monto, cargos e inventario sin declarar recuperaciones no confirmadas', () => {
  const reconciliation = buildRefundReconciliation({
    returnId: 'return-1', inventoryMovements: [{ type: 'RETURN_IN', quantity: 1 }],
    order: {
      paymentFee: 155.26, shippingPrice: 103, orderItems: [{ qty: 1, unitCost: 350 }],
      externalOrders: [{ channel: 'MERCADOLIBRE', rawData: { payments: [{ status: 'refunded', transaction_amount: 1070.75 }] } }],
    },
  });
  assert.equal(reconciliation.refundAmount, 1070.75);
  assert.equal(reconciliation.estimatedExposure, 258.26);
  assert.equal(reconciliation.inventoryStatus, 'RESTOCKED');
  assert.equal(reconciliation.commissionRecoveryStatus, 'PENDING_BILLING_CREDIT');
});

test('lee la comisión por artículo y suma el costo mientras el producto no regresa', () => {
  const reconciliation = buildRefundReconciliation({
    order: {
      paymentFee: 0, shippingPrice: 103, orderItems: [{ qty: 1, unitCost: 350 }],
      externalOrders: [{ channel: 'MERCADOLIBRE', rawData: { order_items: [{ sale_fee: 155.26 }], payments: [{ status: 'refunded', transaction_amount: 1070.75 }] } }],
    },
  });
  assert.equal(reconciliation.commissionAtRisk, 155.26);
  assert.equal(reconciliation.inventoryCostAtRisk, 350);
  assert.equal(reconciliation.estimatedExposure, 608.26);
});

test('incluye responsable y suplente de la asignación más reciente', () => {
  const alerts = buildCriticalClaimAlerts({
    externalClaimId: '13', status: 'opened', activities: [
      { action: 'DASHBOARD_ALERT_ASSIGNED', createdAt: '2026-08-30', details: { alertKind: 'CLAIM', primaryUserId: 'old' } },
      { action: 'DASHBOARD_ALERT_ASSIGNED', createdAt: '2026-08-31', details: { alertKind: 'CLAIM', primaryUserId: 'new', backupUserId: 'backup' } },
    ],
  });
  assert.equal(alerts[0].assignment.primaryUserId, 'new');
  assert.equal(alerts[0].assignment.backupUserId, 'backup');
});

test('escala al responsable a los 15 minutos y a administración a los 30', () => {
  assert.equal(getCriticalEscalationLevel(14), null);
  assert.equal(getCriticalEscalationLevel(15), 'LEVEL_1');
  assert.equal(getCriticalEscalationLevel(30), 'LEVEL_2');
});
