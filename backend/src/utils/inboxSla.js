const BASE_RESPONSE_MINUTES = {
  WHATSAPP: 15, SUPPORT: 120, MELI_QUESTION: 30, MELI_POST_SALE: 60, MELI_CLAIM: 60, TECATL: 10,
};
const PRIORITY_FACTOR = { URGENT: 0.5, HIGH: 0.75, NORMAL: 1, LOW: 1.5 };

const minutesBetween = (start, end) => Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 60000);

const evaluateInboxSla = (item, now = new Date()) => {
  const messages = (item.messages || []).filter((message) => message.at).sort((a, b) => new Date(a.at) - new Date(b.at));
  const targetMinutes = Math.max(5, Math.round((BASE_RESPONSE_MINUTES[item.sourceType] || 120) * (PRIORITY_FACTOR[item.priority] || 1)));
  const firstInbound = messages.find((message) => message.direction === 'INBOUND');
  const firstOutbound = firstInbound && messages.find((message) => message.direction === 'OUTBOUND' && new Date(message.at) >= new Date(firstInbound.at));
  const lastInbound = [...messages].reverse().find((message) => message.direction === 'INBOUND');
  const outboundAfterLast = lastInbound && messages.some((message) => message.direction === 'OUTBOUND' && new Date(message.at) > new Date(lastInbound.at));
  const pendingSince = lastInbound && !outboundAfterLast && item.canReply && Number(item.unreadCount || 0) > 0 ? new Date(lastInbound.at) : null;
  const dueAt = pendingSince ? new Date(pendingSince.getTime() + targetMinutes * 60000) : null;
  const elapsedMinutes = pendingSince ? minutesBetween(pendingSince, now) : null;
  const remainingMinutes = dueAt ? Math.round((dueAt.getTime() - new Date(now).getTime()) / 60000) : null;
  const state = !pendingSince ? 'MET' : remainingMinutes < 0 ? 'BREACHED' : remainingMinutes <= Math.max(5, targetMinutes * 0.25) ? 'AT_RISK' : 'ON_TRACK';
  return {
    targetMinutes, state, pendingSince, dueAt, elapsedMinutes: elapsedMinutes == null ? null : Math.round(elapsedMinutes), remainingMinutes,
    firstResponseMinutes: firstInbound && firstOutbound ? Math.round(minutesBetween(firstInbound.at, firstOutbound.at)) : null,
    firstResponseMet: firstInbound && firstOutbound ? minutesBetween(firstInbound.at, firstOutbound.at) <= targetMinutes : null,
  };
};

export { BASE_RESPONSE_MINUTES, evaluateInboxSla, minutesBetween };
