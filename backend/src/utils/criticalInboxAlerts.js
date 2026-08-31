import { getMeliClaimOutcome } from './meliClaimOutcome.js';

const acknowledgedKinds = (activities = []) => new Set(
  activities
    .filter((activity) => activity.action === 'DASHBOARD_ALERT_ACKNOWLEDGED')
    .map((activity) => String(activity.details?.alertKind || '').toUpperCase())
    .filter(Boolean)
);

export const buildCriticalClaimAlerts = (claim = {}) => {
  const acknowledged = acknowledgedKinds(claim.activities);
  const alerts = [];
  const externalClaimId = String(claim.externalClaimId || '');
  const outcome = getMeliClaimOutcome(claim);

  if (String(claim.status || '').toLowerCase() === 'opened' && !acknowledged.has('CLAIM')) {
    alerts.push({
      id: `${externalClaimId}:CLAIM`, kind: 'CLAIM', claimId: externalClaimId,
      title: 'Reclamo pendiente de atención',
      message: claim.title || claim.problem || claim.description || `Mercado Libre abrió el reclamo ${externalClaimId}.`,
      priority: claim.priority || 'HIGH', at: claim.updatedAt || claim.createdAt || null,
      orderNumber: claim.order?.orderNumber || null,
    });
  }

  if (outcome?.refunded && !acknowledged.has('REFUND')) {
    alerts.push({
      id: `${externalClaimId}:REFUND`, kind: 'REFUND', claimId: externalClaimId,
      title: 'Reembolso confirmado', message: outcome.summary,
      priority: 'URGENT', at: outcome.at || claim.updatedAt || null,
      orderNumber: claim.order?.orderNumber || null,
    });
  }

  return alerts;
};

