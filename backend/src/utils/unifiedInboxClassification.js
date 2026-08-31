export const INBOX_SECTIONS = {
  IMPORTANT: 'IMPORTANT',
  CONVERSATIONS: 'CONVERSATIONS',
};

export const classifyInboxItem = (item = {}) => {
  if (item.sourceType === 'ORDER_CANCELLATION') {
    return { section: INBOX_SECTIONS.IMPORTANT, type: 'CANCELLATION', typeLabel: 'Cancelación', important: true };
  }

  if (item.sourceType === 'MELI_CLAIM') {
    const hasReturn = Boolean(item.returnId || item.returnStatus || item.returnShipmentId);
    const cancellationReason = String(item.outcome?.reason || '').toLowerCase().includes('cancelación');
    const cancelledOrder = String(item.linkedOrder?.status || '').toUpperCase() === 'CANCELLED';
    if (hasReturn) return { section: INBOX_SECTIONS.IMPORTANT, type: 'RETURN', typeLabel: 'Devolución', important: true };
    if (cancellationReason || cancelledOrder) return { section: INBOX_SECTIONS.IMPORTANT, type: 'CANCELLATION', typeLabel: 'Cancelación', important: true };
    return { section: INBOX_SECTIONS.IMPORTANT, type: 'CLAIM', typeLabel: 'Reclamo', important: true };
  }

  if (item.sourceType === 'MELI_QUESTION') {
    return { section: INBOX_SECTIONS.CONVERSATIONS, type: 'QUESTION', typeLabel: 'Pregunta preventa', important: false };
  }

  return { section: INBOX_SECTIONS.CONVERSATIONS, type: 'PRIVATE_MESSAGE', typeLabel: 'Mensaje privado', important: false };
};

export const shouldNotifyNewClaim = (previousClaim, nextClaim) => (
  String(nextClaim?.status || '').toLowerCase() === 'opened'
  && String(previousClaim?.status || '').toLowerCase() !== 'opened'
);

export const shouldNotifyCancellation = (previousStatus, nextStatus) => (
  String(previousStatus || '').toUpperCase() !== 'CANCELLED'
  && String(nextStatus || '').toUpperCase() === 'CANCELLED'
);
