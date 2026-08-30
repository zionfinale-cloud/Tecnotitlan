import { getInboxItemsSnapshot } from '../controllers/unifiedInboxController.js';
import { findRecentNotificationLog, writeNotificationLog } from './notificationLogService.js';
import logger from '../utils/logger.js';

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

const startSlaMonitor = () => {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => scanSlaAlerts().catch((error) => logger.warn(`[SLA] No se pudo completar el escaneo: ${error.message}`));
  setTimeout(run, 30000);
  timer = setInterval(run, 5 * 60 * 1000);
  timer.unref?.();
};

const stopSlaMonitor = () => { if (timer) clearInterval(timer); timer = null; };

export { scanSlaAlerts, startSlaMonitor, stopSlaMonitor };
