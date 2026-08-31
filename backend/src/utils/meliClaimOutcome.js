const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];

const BENEFICIARY_LABELS = {
  complainant: 'comprador',
  respondent: 'vendedor',
  mediator: 'Mercado Libre',
};

const CLOSE_REASON_LABELS = {
  coverage_decision: 'decisión de cobertura',
  buyer_cancelled: 'cancelación solicitada por el comprador',
  seller_cancelled: 'cancelación del vendedor',
  refunded: 'reembolso',
};

export const findMeliOrderByShipment = (orders = [], shipmentId = '') => orders.find((order) => (
  String(order?.shippingInfo?.shippingId || order?.shippingInfo?.id || '') === String(shipmentId)
)) || null;

export const getMeliClaimOutcome = (claim = {}) => {
  const resolution = asObject(claim.rawData?.resolution);
  const history = asArray(claim.historyData);
  const closedHistory = [...history].reverse().find((entry) => entry?.status === 'closed');
  const isClosed = String(claim.status || '').toLowerCase() === 'closed' || Boolean(resolution.date_created || closedHistory);
  if (!isClosed) return null;

  const beneficiaries = asArray(resolution.benefited).map((role) => BENEFICIARY_LABELS[role] || role);
  const beneficiaryText = beneficiaries.length ? beneficiaries.join(' y ') : 'sin beneficiario informado';
  const beneficiaryPhrase = beneficiaries.includes('comprador')
    ? 'del comprador'
    : beneficiaries.includes('vendedor')
      ? 'del vendedor'
      : `de ${beneficiaryText}`;
  const reason = CLOSE_REASON_LABELS[resolution.reason] || resolution.reason || 'resolución de Mercado Libre';
  const closedBy = BENEFICIARY_LABELS[resolution.closed_by] || resolution.closed_by || closedHistory?.change_by || 'Mercado Libre';
  const orderCancelled = String(claim.order?.status || '').toUpperCase() === 'CANCELLED';
  const externalOrder = asArray(claim.order?.externalOrders).find((entry) => entry?.channel === 'MERCADOLIBRE')
    || asArray(claim.order?.externalOrders)[0];
  const refundedPayment = asArray(externalOrder?.rawData?.payments).find((payment) => (
    String(payment?.status || '').toLowerCase() === 'refunded'
  ));
  const parts = [`Mercado Libre cerró el reclamo a favor ${beneficiaryPhrase} por ${reason}.`];

  if (resolution.applied_coverage === true) parts.push('Mercado Libre indicó que aplicó cobertura.');
  if (orderCancelled) parts.push(`El pedido ${claim.order.orderNumber || ''} quedó cancelado.`.replace('  ', ' '));
  if (refundedPayment) {
    const amount = Number(refundedPayment.transaction_amount ?? refundedPayment.total_paid_amount);
    const amountText = Number.isFinite(amount)
      ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: refundedPayment.currency_id || externalOrder?.rawData?.currency_id || 'MXN' }).format(amount)
      : 'el importe pagado';
    parts.push(`Mercado Libre confirmó el reembolso de ${amountText}${refundedPayment.date_last_modified ? ` el ${refundedPayment.date_last_modified}` : ''}.`);
  } else if (claim.refundAt) parts.push(`El reembolso fue reportado el ${claim.refundAt}.`);
  else if (claim.moneyStatus) parts.push(`Estado del dinero: ${claim.moneyStatus}.`);
  else if (orderCancelled && claim.order?.isPaid === false) parts.push('El pago ya no figura vigente en la orden sincronizada.');

  return {
    headline: beneficiaries.includes('comprador')
      ? 'Reclamo cerrado a favor del comprador'
      : beneficiaries.includes('vendedor')
        ? 'Reclamo cerrado a favor del vendedor'
        : 'Reclamo cerrado por Mercado Libre',
    summary: parts.join(' '),
    reason,
    beneficiary: beneficiaryText,
    closedBy,
    appliedCoverage: resolution.applied_coverage === true,
    refunded: Boolean(refundedPayment || claim.refundAt),
    at: resolution.date_created || closedHistory?.date || claim.updatedAt || null,
  };
};
