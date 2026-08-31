import React, { useEffect, useState } from 'react';
import api from '../../services/apiService';
import styles from './MercadoLibreClaimsScreen.module.css';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const internalLabels = {
  PENDING_REVIEW: 'Pendiente de revisar', IN_PROGRESS: 'En atencion', WAITING_BUYER: 'Esperando comprador',
  WAITING_MELI: 'Esperando Mercado Libre', INSPECTION: 'En inspeccion', RESOLVED: 'Resuelto',
};
const inspectionLabels = {
  NOT_RECEIVED: 'No recibido', IN_TRANSIT: 'En transito', RECEIVED: 'Recibido', INSPECTING: 'Inspeccionando',
  SELLABLE: 'Vendible', DAMAGED: 'Dañado', INCOMPLETE: 'Incompleto',
};
const actionLabels = { allow_return: 'Autorizar devolucion', refund: 'Reembolsar', open_dispute: 'Solicitar mediacion' };

const asArray = (value) => Array.isArray(value) ? value : Array.isArray(value?.messages) ? value.messages : [];
const fmtDate = (value) => value ? dateTime.format(new Date(value)) : 'Sin fecha';

const MercadoLibreClaimsScreen = () => {
  const [claims, setClaims] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [message, setMessage] = useState('');

  const loadClaims = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/mercadolibre/claims');
      const next = data.data.claims || [];
      setClaims(next);
      setSelectedId((current) => current || next[0]?.externalClaimId || '');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los reclamos.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useRealtimeRefresh(['meli', 'orders', 'returns'], () => loadClaims({ silent: true }));
  useEffect(() => { loadClaims(); }, []);
  const selected = claims.find((claim) => claim.externalClaimId === selectedId) || claims[0];
  const openCount = claims.filter((claim) => claim.status === 'opened').length;
  const urgentCount = claims.filter((claim) => claim.priority === 'URGENT' || (claim.dueDate && new Date(claim.dueDate) < new Date(Date.now() + 86400000))).length;
  const returnCount = claims.filter((claim) => claim.returnId).length;
  const messages = asArray(selected?.messagesData);
  const seller = (selected?.rawData?.players || []).find((player) => player.role === 'respondent');
  const availableActions = (seller?.available_actions || []).map((entry) => typeof entry === 'string' ? entry : entry.action).filter((action) => actionLabels[action]);
  const returnShipment = (selected?.returnData?.shipments || [])[0];

  const run = async (request, doneMessage) => {
    setBusy(true); setError(''); setSuccess('');
    try {
      await request();
      await loadClaims({ silent: true });
      setSuccess(doneMessage);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo completar la operacion.');
    } finally { setBusy(false); }
  };

  const sync = () => run(() => api.post('/mercadolibre/claims/sync'), 'Reclamos sincronizados con Mercado Libre.');
  const refresh = () => run(() => api.post(`/mercadolibre/claims/${selected.externalClaimId}/refresh`), 'Expediente actualizado.');
  const update = (payload) => run(() => api.put(`/mercadolibre/claims/${selected.externalClaimId}`, payload), 'Control interno actualizado.');
  const sendMessage = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    const receiverRole = selected.stage === 'dispute' ? 'mediator' : 'complainant';
    await run(() => api.post(`/mercadolibre/claims/${selected.externalClaimId}/messages`, { message: text, receiverRole }), 'Mensaje enviado y registrado.');
    setMessage('');
  };
  const executeAction = (action) => {
    const label = actionLabels[action];
    const confirmation = window.prompt(`${label} puede afectar dinero o la resolucion. Escribe ${selected.externalClaimId} para confirmar.`);
    if (confirmation !== selected.externalClaimId) return;
    run(() => api.post(`/mercadolibre/claims/${selected.externalClaimId}/actions`, { action, confirmation }), `${label} aplicado correctamente.`);
  };

  if (loading) return <div className={styles.empty}>Cargando Centro de Reclamos...</div>;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span>Postventa segura</span><h1>Reclamos y devoluciones</h1><p>Expedientes vinculados con pedidos, plazos, mensajes, dinero y recepción física.</p></div>
        <button onClick={sync} disabled={busy}><i className="fas fa-sync-alt" /> Sincronizar Mercado Libre</button>
      </header>
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      <section className={styles.stats}>
        <article><small>Abiertos</small><strong>{openCount}</strong></article>
        <article><small>Urgentes / por vencer</small><strong>{urgentCount}</strong></article>
        <article><small>Con devolucion</small><strong>{returnCount}</strong></article>
        <article><small>Total expedientes</small><strong>{claims.length}</strong></article>
      </section>
      {claims.length === 0 ? (
        <div className={styles.empty}><i className="fas fa-shield-alt" /><h2>No hay reclamos sincronizados</h2><p>Cuando Mercado Libre genere uno aparecerá aquí mediante el webhook post_purchase.</p></div>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.list}>
            {claims.map((claim) => <button key={claim.id} className={claim.externalClaimId === selected?.externalClaimId ? styles.active : ''} onClick={() => setSelectedId(claim.externalClaimId)}>
              <span><b>ML #{claim.externalClaimId}</b><em>{claim.priority}</em></span>
              <strong>{claim.title || claim.problem || claim.type || 'Reclamo Mercado Libre'}</strong>
              <small>{claim.order?.orderNumber || `Orden ML ${claim.externalOrderId || 'pendiente'}`} · {internalLabels[claim.internalStatus] || claim.internalStatus}</small>
              <small>Vence: {fmtDate(claim.dueDate)}</small>
            </button>)}
          </aside>
          {selected && <main className={styles.detail}>
            <div className={styles.detailHeader}><div><span>Reclamo #{selected.externalClaimId}</span><h2>{selected.title || 'Expediente Mercado Libre'}</h2><p>{selected.description || selected.problem || 'Sin descripcion adicional.'}</p></div><button onClick={refresh} disabled={busy}>Actualizar expediente</button></div>
            <section className={styles.grid}>
              <article><h3>Riesgo y plazo</h3><dl><div><dt>Estado ML</dt><dd>{selected.status} / {selected.stage || 'sin etapa'}</dd></div><div><dt>Responsable</dt><dd>{selected.actionResponsible || 'Sin definir'}</dd></div><div><dt>Fecha limite</dt><dd>{fmtDate(selected.dueDate)}</dd></div><div><dt>Reputacion</dt><dd>{selected.affectsReputation === true ? 'Puede afectar' : selected.affectsReputation === false ? 'No afecta' : 'Por confirmar'}</dd></div></dl></article>
              <article><h3>Pedido relacionado</h3><dl><div><dt>Tecnotitlan</dt><dd>{selected.order?.orderNumber || 'No vinculado'}</dd></div><div><dt>Orden ML</dt><dd>{selected.externalOrderId || 'Pendiente'}</dd></div><div><dt>Total</dt><dd>{selected.order ? money.format(selected.order.totalPrice) : '—'}</dd></div><div><dt>Motivo</dt><dd>{selected.problem || selected.reasonId || 'Sin detalle'}</dd></div></dl></article>
              <article><h3>Devolucion y dinero</h3><dl><div><dt>Estado</dt><dd>{selected.returnStatus || 'Sin devolucion'}</dd></div><div><dt>Rastreo</dt><dd>{selected.returnTrackingNumber || 'Pendiente'}</dd></div><div><dt>Destino</dt><dd>{returnShipment?.destination?.name || 'Pendiente'}</dd></div><div><dt>Costo</dt><dd>{selected.returnCost != null ? `${money.format(selected.returnCost)} ${selected.returnCurrency || ''}` : 'Por confirmar'}</dd></div><div><dt>Dinero</dt><dd>{selected.moneyStatus || 'Por confirmar'} · reembolso {selected.refundAt || 'sin fecha'}</dd></div></dl></article>
            </section>
            <section className={styles.controls}><h3>Control interno e inspeccion</h3><div>
              <label>Atencion<select value={selected.internalStatus} onChange={(e) => update({ internalStatus: e.target.value })} disabled={busy}>{Object.entries(internalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Prioridad<select value={selected.priority} onChange={(e) => update({ priority: e.target.value })} disabled={busy}>{['LOW','NORMAL','HIGH','URGENT'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Recepcion<select value={selected.inspectionStatus} onChange={(e) => update({ inspectionStatus: e.target.value })} disabled={busy}>{Object.entries(inspectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Responsable<input value={selected.assignedTo || ''} onChange={(e) => setClaims((current) => current.map((item) => item.id === selected.id ? {...item, assignedTo: e.target.value} : item))} onBlur={(e) => update({ assignedTo: e.target.value })} /></label>
            </div><label>Notas de inspeccion<textarea rows="3" value={selected.inspectionNotes || ''} onChange={(e) => setClaims((current) => current.map((item) => item.id === selected.id ? {...item, inspectionNotes: e.target.value} : item))} onBlur={(e) => update({ inspectionNotes: e.target.value })} placeholder="Condicion, accesorios, serie, empaque y evidencia..." /></label></section>
            {availableActions.length > 0 && <section className={styles.actions}><h3>Acciones disponibles en Mercado Libre</h3><p>Solo se muestran acciones que Mercado Libre habilita para este reclamo. Requieren confirmar el folio.</p><div>{availableActions.map((action) => <button key={action} onClick={() => executeAction(action)} disabled={busy}>{actionLabels[action]}</button>)}</div></section>}
            <section className={styles.conversation}><h3>Conversacion del reclamo</h3><div className={styles.messages}>{messages.length ? messages.map((item, index) => <article key={item.id || item.message_id || index}><b>{item.sender_role || item.from?.role || 'Participante'}</b><p>{item.message || item.text?.plain || item.text || 'Mensaje sin texto'}</p><small>{fmtDate(item.date_created || item.date)}</small></article>) : <p>Sin mensajes disponibles para este expediente.</p>}</div>
              {selected.status === 'opened' && <form onSubmit={sendMessage}><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows="3" placeholder={selected.stage === 'dispute' ? 'Escribe al mediador de Mercado Libre...' : 'Escribe al comprador dentro del reclamo...'} /><button disabled={busy || !message.trim()}>Enviar mensaje</button></form>}
            </section>
          </main>}
        </div>
      )}
    </div>
  );
};

export default MercadoLibreClaimsScreen;
