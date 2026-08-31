import { getMeliClaimOutcome } from './meliClaimOutcome.js';

const acknowledgedKinds = (activities = []) => new Set(
  activities
    .filter((activity) => activity.action === 'DASHBOARD_ALERT_ACKNOWLEDGED')
    .map((activity) => String(activity.details?.alertKind || '').toUpperCase())
    .filter(Boolean)
);

const latestAssignment = (activities = [], alertKind) => [...activities]
  .filter((activity) => (
    activity.action === 'DASHBOARD_ALERT_ASSIGNED'
    && String(activity.details?.alertKind || '').toUpperCase() === alertKind
  ))
  .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0]?.details || null;

const getExternalOrder = (claim = {}) => (claim.order?.externalOrders || []).find((entry) => entry.channel === 'MERCADOLIBRE')
  || claim.order?.externalOrders?.[0];

const refundedPayment = (claim = {}) => {
  const externalOrder = getExternalOrder(claim);
  return (externalOrder?.rawData?.payments || []).find((payment) => String(payment.status || '').toLowerCase() === 'refunded') || null;
};

export const buildRefundReconciliation = (claim = {}) => {
  const payment = refundedPayment(claim);
  const externalOrder = getExternalOrder(claim);
  const refundAmount = Number(payment?.transaction_amount ?? payment?.total_paid_amount ?? 0);
  const itemFees = (externalOrder?.rawData?.order_items || []).reduce((sum, item) => sum + Number(item.sale_fee || 0), 0);
  const commissionAtRisk = Number(claim.order?.paymentFee || externalOrder?.feesEstimated || itemFees || 0);
  const confirmedSellerShippingCost = (externalOrder?.rawData?.tecnotitlan_shipping_costs?.senders || [])
    .reduce((sum, sender) => sum + Number(sender.cost || 0), 0);
  const shippingAtRisk = Number(confirmedSellerShippingCost || claim.order?.shippingPrice || 0);
  const returnShippingAtRisk = Number(claim.returnCost || 0);
  const soldQuantity = (claim.order?.orderItems || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const cancellationRestocked = (claim.inventoryMovements || [])
    .filter((movement) => movement.type === 'RETURN_IN')
    .reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0);
  const inspectedRestocked = (claim.order?.returnInspections || [])
    .flatMap((inspection) => inspection.items || [])
    .reduce((sum, item) => sum + Number(item.releasedQty || 0), 0);
  const restockedQuantity = cancellationRestocked + inspectedRestocked;
  const inventoryCost = (claim.order?.orderItems || []).reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.qty || 0), 0);
  const inventoryCostAtRisk = soldQuantity > 0
    ? inventoryCost * Math.max(0, soldQuantity - Math.min(restockedQuantity, soldQuantity)) / soldQuantity
    : 0;
  const inventoryStatus = soldQuantity > 0 && restockedQuantity >= soldQuantity
    ? 'RESTOCKED'
    : claim.returnId || claim.returnStatus
      ? 'PENDING_INSPECTION'
      : 'PENDING_REVIEW';
  return {
    refundAmount,
    commissionAtRisk,
    shippingAtRisk,
    inventoryCostAtRisk,
    returnShippingAtRisk,
    estimatedExposure: commissionAtRisk + shippingAtRisk + returnShippingAtRisk + inventoryCostAtRisk,
    commissionRecoveryStatus: 'PENDING_BILLING_CREDIT',
    shippingRecoveryStatus: confirmedSellerShippingCost ? 'CONFIRMED_CHARGE' : 'PENDING_VERIFICATION',
    soldQuantity,
    restockedQuantity,
    inventoryStatus,
  };
};

export const getCriticalEscalationLevel = (ageMinutes) => {
  const age = Number(ageMinutes || 0);
  if (age >= 30) return 'LEVEL_2';
  if (age >= 15) return 'LEVEL_1';
  return null;
};

export const buildCriticalClaimAlerts = (claim = {}) => {
  const acknowledged = acknowledgedKinds(claim.activities);
  const alerts = [];
  const externalClaimId = String(claim.externalClaimId || '');
  const outcome = getMeliClaimOutcome(claim);

  if (String(claim.status || '').toLowerCase() === 'opened' && !acknowledged.has('CLAIM')) {
    const assignment = latestAssignment(claim.activities, 'CLAIM');
    alerts.push({
      id: `${externalClaimId}:CLAIM`, kind: 'CLAIM', claimId: externalClaimId,
      title: 'Reclamo pendiente de atención',
      message: claim.title || claim.problem || claim.description || `Mercado Libre abrió el reclamo ${externalClaimId}.`,
      priority: claim.priority || 'HIGH', at: claim.updatedAt || claim.createdAt || null,
      orderNumber: claim.order?.orderNumber || null,
      assignment,
    });
  }

  if (outcome?.refunded && !acknowledged.has('REFUND')) {
    const assignment = latestAssignment(claim.activities, 'REFUND');
    alerts.push({
      id: `${externalClaimId}:REFUND`, kind: 'REFUND', claimId: externalClaimId,
      title: 'Reembolso confirmado', message: outcome.summary,
      priority: 'URGENT', at: outcome.at || claim.updatedAt || null,
      orderNumber: claim.order?.orderNumber || null,
      assignment,
      reconciliation: buildRefundReconciliation(claim),
    });
  }

  return alerts;
};
