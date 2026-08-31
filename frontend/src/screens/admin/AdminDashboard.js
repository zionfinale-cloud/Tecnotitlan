import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/apiService';
import styles from './AdminDashboard.module.css';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState({ summary: {}, topPages: [], sources: [], countries: [], referrers: [], daily: [] });
  const [quality, setQuality] = useState({}); const [critical, setCritical] = useState({ alerts: [], assignees: [], metrics: {}, notificationHealth: {} }); const [days, setDays] = useState(30); const [error, setError] = useState(''); const [busyAlert, setBusyAlert] = useState(''); const [notificationPermission, setNotificationPermission] = useState(() => 'Notification' in window ? Notification.permission : 'unsupported');
  const load = useCallback(() => Promise.all([api.get(`/analytics/dashboard?days=${days}`), api.get('/service-quality/dashboard'), api.get('/unified-inbox/critical-alerts')]).then(([views, service, criticalResponse]) => { setAnalytics(views.data.data); setQuality(service.data.data.summary || {}); setCritical(criticalResponse.data.data || { alerts: [], assignees: [], metrics: {}, notificationHealth: {} }); }).catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar las métricas.')), [days]);
  useRealtimeRefresh(['dashboard', 'quality', 'orders', 'inventory'], load);
  useEffect(() => { load(); }, [load]);
  const acknowledgeAlert = async (alert) => {
    setBusyAlert(alert.id); setError('');
    try { await api.post(`/unified-inbox/critical-alerts/${encodeURIComponent(alert.claimId)}/${alert.kind}/acknowledge`); await load(); }
    catch (err) { setError(err.response?.data?.message || 'No se pudo marcar la alerta como revisada.'); }
    finally { setBusyAlert(''); }
  };
  const enableBrowserNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission(); setNotificationPermission(permission);
    if (permission === 'granted') new Notification('Avisos Tecnotitlan activados', { body: 'Recibirás reclamos, reembolsos y escalaciones críticas.' });
  };
  const alerts = critical.alerts || [];
  const incidentMetrics = critical.metrics || {};
  const whatsapp = critical.notificationHealth?.whatsapp || {};
  const maxDaily = Math.max(...(analytics.daily || []).map((entry) => entry.count), 1);
  return <div className={styles.dashboard}><header><div><span>Vista ejecutiva</span><h1>Dashboard de administración</h1><p>Tráfico, origen de visitantes y calidad de atención en una sola lectura.</p></div><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></header>{error && <div className={styles.error}>{error}</div>}
    <section className={styles.channelHealth}><div className={whatsapp.connected ? styles.channelOk : styles.channelWarning}><i className={`fab fa-whatsapp`} /><span><b>WhatsApp {whatsapp.connected ? 'conectado' : 'sin conexión'}</b><small>{whatsapp.connected ? 'Avisos operativos disponibles' : whatsapp.hasSavedSession ? 'Reintenta la sesión guardada' : 'Vincula el número mediante QR'}</small></span>{!whatsapp.connected && <Link to="/admin/settings/whatsapp">Configurar</Link>}</div><div className={notificationPermission === 'granted' ? styles.channelOk : styles.channelWarning}><i className="fas fa-bell" /><span><b>Avisos del navegador</b><small>{notificationPermission === 'granted' ? 'Activos en este navegador' : 'Actívalos para recibir casos críticos'}</small></span>{notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && <button onClick={enableBrowserNotifications}>Activar</button>}</div></section>
    {alerts.length > 0 && <section className={styles.criticalAlerts} role="alert" aria-live="assertive"><div className={styles.criticalHeader}><i className="fas fa-exclamation-triangle" /><div><span>Atención inmediata</span><h2>{alerts.length} {alerts.length === 1 ? 'caso crítico requiere' : 'casos críticos requieren'} revisión</h2><p>Se escalan a los 15 minutos y nuevamente a administración a los 30 minutos mientras no exista acuse.</p></div></div><div className={styles.alertList}>{alerts.slice(0, 5).map((alert) => <article key={alert.id}><div className={styles.alertBody}><b>{alert.title}</b><p>{alert.message}</p><small>{alert.orderNumber || `Reclamo ${alert.claimId}`}</small>{alert.reconciliation && <Reconciliation data={alert.reconciliation} />}</div><div className={styles.alertActions}><AlertAssignment alert={alert} assignees={critical.assignees || []} onSaved={load} setError={setError} /><span><Link to="/admin/inbox">Atender ahora</Link><button disabled={busyAlert === alert.id} onClick={() => acknowledgeAlert(alert)}>{busyAlert === alert.id ? 'Guardando…' : 'Marcar revisado'}</button></span></div></article>)}</div>{alerts.length > 5 && <Link className={styles.viewAll} to="/admin/inbox">Ver los {alerts.length} casos en Bandeja unificada</Link>}</section>}
    <section className={styles.incidentCards}><article><small>Reclamos 30 días</small><strong>{incidentMetrics.claims30d || 0}</strong></article><article><small>Reembolsos 30 días</small><strong>{incidentMetrics.refunds30d || 0}</strong><span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(incidentMetrics.refundAmount30d || 0)}</span></article><article><small>Sin responsable</small><strong>{incidentMetrics.unassigned || 0}</strong></article><article><small>Tiempo para revisar</small><strong>{incidentMetrics.averageAcknowledgeMinutes == null ? '—' : `${incidentMetrics.averageAcknowledgeMinutes} min`}</strong></article><article><small>Escalados</small><strong>{incidentMetrics.escalated || 0}</strong></article></section>
    <section className={styles.cards}><article><small>Vistas</small><strong>{analytics.summary.views || 0}</strong><span>{analytics.summary.viewsToday || 0} hoy</span></article><article><small>Visitantes aproximados</small><strong>{analytics.summary.visitors || 0}</strong><span>sin guardar IP</span></article><article><small>Páginas por visitante</small><strong>{analytics.summary.pagesPerVisitor || 0}</strong><span>promedio</span></article><article><small>SLA cumplido</small><strong>{quality.compliance == null ? '—' : `${quality.compliance}%`}</strong><span>{quality.breached || 0} vencidos</span></article><article><small>Calidad</small><strong>{quality.averageQuality == null ? '—' : `${quality.averageQuality}/5`}</strong><span>{quality.reviews || 0} revisiones</span></article></section>
    <section className={styles.chart}><div><h2>Vistas por día</h2><p>Las recargas repetidas en menos de 30 segundos se deduplican.</p></div><div className={styles.bars}>{analytics.daily?.length ? analytics.daily.map((entry) => <div key={entry.date}><span style={{height:`${Math.max(8,entry.count*100/maxDaily)}%`}} title={`${entry.date}: ${entry.count}`} /><small>{entry.date.slice(5)}</small></div>) : <p>Aún no hay vistas registradas.</p>}</div></section>
    <section className={styles.tables}><Metric title="Páginas más vistas" rows={analytics.topPages} /><Metric title="Origen del tráfico" rows={analytics.sources} /><Metric title="País" rows={analytics.countries} /><Metric title="Referentes" rows={analytics.referrers} /></section>
    <div className={styles.privacy}><i className="fas fa-user-shield" /><p>Analítica propia: no almacena direcciones IP, excluye panel administrativo y bots, respeta “Do Not Track” y usa un hash diario irreversible para estimar visitantes.</p></div>
  </div>;
};
const Metric = ({ title, rows = [] }) => <article><h2>{title}</h2>{rows.length ? rows.slice(0, 7).map((row) => <div key={row.label}><span>{row.label}</span><b>{row.count}</b></div>) : <p>Sin datos todavía.</p>}</article>;

const AlertAssignment = ({ alert, assignees, onSaved, setError }) => {
  const [primaryUserId, setPrimaryUserId] = useState(alert.assignment?.primaryUserId || '');
  const [backupUserId, setBackupUserId] = useState(alert.assignment?.backupUserId || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!primaryUserId) return;
    setSaving(true); setError('');
    try { await api.put(`/unified-inbox/critical-alerts/${encodeURIComponent(alert.claimId)}/${alert.kind}/assignment`, { primaryUserId, backupUserId: backupUserId || null }); await onSaved(); }
    catch (err) { setError(err.response?.data?.message || 'No se pudo asignar el caso.'); }
    finally { setSaving(false); }
  };
  const label = (user) => `${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email} · ${user.role?.name || 'Equipo'}`;
  return <div className={styles.assignment}><label>Responsable<select value={primaryUserId} onChange={(event) => setPrimaryUserId(event.target.value)}><option value="">Seleccionar…</option>{assignees.map((user) => <option key={user.id} value={user.id}>{label(user)}</option>)}</select></label><label>Suplente<select value={backupUserId} onChange={(event) => setBackupUserId(event.target.value)}><option value="">Sin suplente</option>{assignees.filter((user) => user.id !== primaryUserId).map((user) => <option key={user.id} value={user.id}>{label(user)}</option>)}</select></label><button disabled={!primaryUserId || saving} onClick={save}>{saving ? 'Asignando…' : alert.assignment ? 'Actualizar responsables' : 'Asignar caso'}</button></div>;
};

const Reconciliation = ({ data }) => {
  const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
  const inventoryLabels = { RESTOCKED: 'Reintegrado', PENDING_INSPECTION: 'Pendiente de inspección', PENDING_REVIEW: 'Pendiente de revisión' };
  return <div className={styles.reconciliation}><b>Conciliación automática</b><span>Reembolso confirmado <strong>{money(data.refundAmount)}</strong></span><span>Comisión pendiente de abono <strong>{money(data.commissionAtRisk)}</strong></span><span>Envío cobrado/por verificar <strong>{money(data.shippingAtRisk)}</strong></span>{data.returnShippingAtRisk > 0 && <span>Envío de devolución <strong>{money(data.returnShippingAtRisk)}</strong></span>}<span>Costo de inventario en riesgo <strong>{money(data.inventoryCostAtRisk)}</strong></span><span>Exposición máxima estimada <strong>{money(data.estimatedExposure)}</strong></span><span>Inventario <strong>{inventoryLabels[data.inventoryStatus] || data.inventoryStatus} ({data.restockedQuantity}/{data.soldQuantity})</strong></span><small>La comisión sólo cambia a recuperada cuando aparezca el abono en facturación de Mercado Libre.</small></div>;
};
export default AdminDashboard;
