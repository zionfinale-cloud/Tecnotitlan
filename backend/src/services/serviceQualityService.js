import { getInboxItemsSnapshot } from '../controllers/unifiedInboxController.js';
import { findRecentNotificationLog, writeNotificationLog } from './notificationLogService.js';
import logger from '../utils/logger.js';
import prisma from '../config/prisma.js';
import { buildCriticalClaimAlerts, getCriticalEscalationLevel } from '../utils/criticalInboxAlerts.js';
import { notifyStaffImportantInboxCase } from './staffNotificationService.js';

let timer = null;

const scanSlaAlerts = async () => {
  const items = await getInboxItemsSnapshot();
  const alerts = items.filter((item) => ['AT_RISK', 'BREACHED'].includes(item.sla?.state));
  let created = 0;
  for (const item of alerts) {
    const event = `inbox_sla_${item.sla.state.toLowerCase()}`;
    const recipient = `${item.sourceType}:${item.sourceId}`;
    const existing = await findRecentNotificationLog({ channel: 'SYSTEM', audience: 'STAFF', event, recipient, status: 'SENT', sinceMs: 12 * 60 * 60 * 1000 });
    if (existing) continue;
    await writeNotificationLog({
      channel: 'SYSTEM', audience: 'STAFF', event, status: 'SENT', provider: 'sla-monitor', recipient,
      orderId: item.linkedOrder?.id, orderNumber: item.linkedOrder?.orderNumber,
      message: item.sla.state === 'BREACHED' ? `SLA vencido en ${item.channel}: ${item.title}` : `SLA por vencer en ${item.channel}: ${item.title}`,
      details: { sourceType: item.sourceType, sourceId: item.sourceId, dueAt: item.sla.dueAt, remainingMinutes: item.sla.remainingMinutes },
    });
    created += 1;
  }
  return { scanned: items.length, activeAlerts: alerts.length, created };
};

const scanCriticalInboxEscalations = async () => {
  const claims = await prisma.meliClaim.findMany({
    include: { activities: true, order: { include: { externalOrders: true, orderItems: true } } },
    orderBy: { updatedAt: 'desc' }, take: 200,
  });
  const alerts = claims.flatMap((claim) => buildCriticalClaimAlerts(claim).map((alert) => ({ ...alert, claim })));
  let escalated = 0;
  for (const alert of alerts) {
    const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(alert.at || alert.claim.createdAt).getTime()) / 60000));
    const level = getCriticalEscalationLevel(ageMinutes);
    if (!level) continue;
    const alreadyEscalated = alert.claim.activities.some((activity) => (
      activity.action === 'DASHBOARD_ALERT_ESCALATED'
      && String(activity.details?.alertKind || '').toUpperCase() === alert.kind
      && activity.details?.level === level
    ));
    if (alreadyEscalated) continue;
    const assignedIds = [alert.assignment?.primaryUserId, alert.assignment?.backupUserId].filter(Boolean);
    await notifyStaffImportantInboxCase({
      event: `escalation_${level.toLowerCase()}_${alert.kind.toLowerCase()}`,
      externalId: alert.claimId, order: alert.claim.order,
      title: level === 'LEVEL_2' ? `Escalamiento administrativo: ${alert.title}` : `Caso sin atender: ${alert.title}`,
      message: `${alert.message} Lleva ${ageMinutes} minutos sin acuse de revisión.`,
      ...(level === 'LEVEL_2'
        ? { recipientRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] }
        : assignedIds.length ? { recipientUserIds: assignedIds } : {}),
    });
    await prisma.meliClaimActivity.create({ data: {
      claimId: alert.claim.id, action: 'DASHBOARD_ALERT_ESCALATED', actorName: 'Monitor SLA',
      details: { alertKind: alert.kind, level, ageMinutes, escalatedAt: new Date().toISOString(), assignedIds },
    } });
    escalated += 1;
  }
  return { scanned: alerts.length, escalated };
};

const startSlaMonitor = () => {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = async () => {
    try { await Promise.all([scanSlaAlerts(), scanCriticalInboxEscalations()]); }
    catch (error) { logger.warn(`[SLA] No se pudo completar el escaneo: ${error.message}`); }
  };
  setTimeout(run, 30000);
  timer = setInterval(run, 5 * 60 * 1000);
  timer.unref?.();
};

const stopSlaMonitor = () => { if (timer) clearInterval(timer); timer = null; };

export { scanSlaAlerts, scanCriticalInboxEscalations, startSlaMonitor, stopSlaMonitor };
