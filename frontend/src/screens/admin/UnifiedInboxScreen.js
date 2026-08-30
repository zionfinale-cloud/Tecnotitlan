import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './UnifiedInboxScreen.module.css';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = (value) => value ? dateTime.format(new Date(value)) : 'Sin fecha';
const channelIcons = { WhatsApp: 'fa-comments', 'Mercado Libre': 'fa-store', Soporte: 'fa-headset', Correo: 'fa-envelope', 'Tecatl Web': 'fa-robot', 'Tecatl WhatsApp': 'fa-robot' };
const sourceLabels = { WHATSAPP: 'WhatsApp', SUPPORT: 'Ticket', MELI_QUESTION: 'Pregunta preventa', MELI_POST_SALE: 'Mensaje posventa', MELI_CLAIM: 'Reclamo', TECATL: 'Tecatl' };
const slaLabels = { BREACHED: 'SLA vencido', AT_RISK: 'SLA por vencer', ON_TRACK: 'SLA en tiempo', MET: 'SLA atendido' };

const UnifiedInboxScreen = () => {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, unlinked: 0, channels: {} });
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('ALL');
  const [onlyPending, setOnlyPending] = useState(false);
  const [reply, setReply] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderResults, setOrderResults] = useState([]);
  const [showOrderSearch, setShowOrderSearch] = useState(false);
  const [templates, setTemplates] = useState([]);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [{ data }, templateResponse] = await Promise.all([api.get('/unified-inbox'), api.get('/service-quality/templates')]);
      const next = data.data.items || [];
      setItems(next);
      setCounts(data.data.counts || {});
      setTemplates(templateResponse.data.data.templates || []);
      setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id || '');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar la bandeja unificada.');
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const searchable = [item.title, item.preview, item.sourceId, item.customer?.name, item.customer?.email, item.customer?.phone, item.linkedOrder?.orderNumber, ...(item.linkedOrder?.items || []).flatMap((entry) => [entry.name, entry.sku])].join(' ').toLowerCase();
    return (!query.trim() || searchable.includes(query.trim().toLowerCase()))
      && (channel === 'ALL' || item.channel === channel)
      && (!onlyPending || item.unreadCount > 0 || ['OPEN','UNANSWERED','opened','HUMAN_REQUIRED'].includes(item.status));
  }), [items, query, channel, onlyPending]);
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || items.find((item) => item.id === selectedId);
  const channels = [...new Set(items.map((item) => item.channel))];

  const run = async (request, message) => {
    setBusy(true); setError(''); setSuccess('');
    try {
      await request();
      await load({ silent: true });
      setSuccess(message);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo completar la operación.');
      return false;
    } finally { setBusy(false); }
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    const ok = await run(() => api.post(`/unified-inbox/${selected.sourceType}/${encodeURIComponent(selected.sourceId)}/reply`, { text: reply.trim() }), 'Respuesta enviada por el canal correcto.');
    if (ok) setReply('');
  };

  const searchOrders = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.get('/unified-inbox/orders', { params: { q: orderQuery } });
      setOrderResults(data.data.orders || []);
    } catch (err) { setError(err.response?.data?.message || 'No se pudieron buscar pedidos.'); }
    finally { setBusy(false); }
  };
  const linkOrder = async (orderId) => {
    const ok = await run(() => api.put(`/unified-inbox/${selected.sourceType}/${encodeURIComponent(selected.sourceId)}/order`, { orderId }), 'Conversación ligada al pedido.');
    if (ok) { setShowOrderSearch(false); setOrderResults([]); setOrderQuery(''); }
  };
  const unlinkOrder = () => run(() => api.delete(`/unified-inbox/${selected.sourceType}/${encodeURIComponent(selected.sourceId)}/order`), 'Vínculo manual eliminado.');
  const applyTemplate = (templateId) => {
    const template = templates.find((entry) => entry.id === templateId); if (!template || !selected) return;
    const rendered = template.body.replaceAll('{{customer_name}}', selected.customer?.name || 'cliente').replaceAll('{{order_number}}', selected.linkedOrder?.orderNumber || 'tu pedido').replaceAll('{{agent_name}}', 'equipo Tecnotitlan').replaceAll('{{agent_note}}', '');
    setReply(rendered);
  };

  if (loading) return <div className={styles.empty}>Preparando la bandeja unificada...</div>;
  return <div className={styles.page}>
    <header className={styles.header}><div><span>Atención 360°</span><h1>Bandeja unificada</h1><p>Conversaciones, reclamos y tickets con el pedido correcto siempre a la vista.</p></div><button onClick={() => load()} disabled={busy}><i className="fas fa-sync-alt" /> Actualizar</button></header>
    {error && <div className={styles.error}>{error}</div>}{success && <div className={styles.success}>{success}</div>}
    <section className={styles.stats}><article><small>Total</small><strong>{counts.total || items.length}</strong></article><article><small>Requieren atención</small><strong>{counts.pending || 0}</strong></article><article><small>Sin pedido identificado</small><strong>{counts.unlinked || 0}</strong></article><article><small>Canales activos</small><strong>{Object.keys(counts.channels || {}).length}</strong></article></section>
    <section className={styles.toolbar}><label className={styles.search}><i className="fas fa-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, pedido, SKU, folio o mensaje..." /></label><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="ALL">Todos los canales</option>{channels.map((value) => <option key={value}>{value}</option>)}</select><label className={styles.pendingToggle}><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} /> Sólo pendientes</label></section>
    {items.length === 0 ? <div className={styles.empty}><i className="fas fa-check-circle" /><h2>Todo está tranquilo</h2><p>Los nuevos contactos de todos los canales aparecerán aquí.</p></div> : <div className={styles.workspace}>
      <aside className={styles.list}>{filtered.length ? filtered.map((item) => <button key={item.id} className={item.id === selected?.id ? styles.active : ''} onClick={() => { setSelectedId(item.id); setReply(''); setShowOrderSearch(false); }}><span><b><i className={`fas ${channelIcons[item.channel] || 'fa-comment'}`} /> {item.channel}</b>{item.unreadCount > 0 && <em>{item.unreadCount}</em>}</span><strong>{item.title}</strong><p>{item.preview || 'Sin vista previa'}</p><small>{sourceLabels[item.sourceType]} · {fmtDate(item.timestamp)}</small>{item.sla && <small className={styles.orderTag}>{slaLabels[item.sla.state]}{item.sla.remainingMinutes != null ? ` · ${Math.abs(item.sla.remainingMinutes)} min` : ''}</small>}{item.linkedOrder && <small className={styles.orderTag}><i className="fas fa-link" /> {item.linkedOrder.orderNumber}</small>}</button>) : <div className={styles.noResults}>No hay coincidencias.</div>}</aside>
      {selected && <main className={styles.detail}>
        <section className={styles.conversation}><div className={styles.title}><div><span>{selected.channel} · {sourceLabels[selected.sourceType]}</span><h2>{selected.title}</h2><p>{selected.customer?.name || selected.customer?.email || selected.customer?.phone || `Referencia ${selected.sourceId}`}</p>{selected.sla && <b>{slaLabels[selected.sla.state]} · objetivo {selected.sla.targetMinutes} min{selected.sla.dueAt ? ` · vence ${fmtDate(selected.sla.dueAt)}` : ''}</b>}</div><a href={selected.deepLink}>Abrir módulo especializado <i className="fas fa-external-link-alt" /></a></div><div className={styles.messages}>{selected.messages?.length ? selected.messages.map((message) => <article key={message.id} className={message.direction === 'OUTBOUND' ? styles.outbound : styles.inbound}><b>{message.direction === 'OUTBOUND' ? 'Tecnotitlan' : 'Cliente'}</b><p>{message.text || 'Mensaje sin texto visible'}</p><small>{fmtDate(message.at)}{message.status ? ` · ${message.status}` : ''}</small></article>) : <p>Este expediente no contiene mensajes visibles.</p>}</div>{selected.canReply ? <form onSubmit={submitReply}><select defaultValue="" onChange={(event) => { applyTemplate(event.target.value); event.target.value = ''; }}><option value="">Insertar plantilla segura...</option>{templates.filter((entry) => !entry.sourceType || entry.sourceType === selected.sourceType).map((entry) => <option key={entry.id} value={entry.id}>{entry.category} · {entry.name}</option>)}</select><textarea rows="4" maxLength={selected.maxLength || 5000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Escribe una respuesta clara y segura..." /><div><small>{reply.length}/{selected.maxLength || 5000}</small><button disabled={busy || !reply.trim()}>Enviar respuesta</button></div></form> : <div className={styles.locked}><i className="fas fa-lock" /> Este canal no admite respuesta en su estado actual.</div>}</section>
        <OrderPanel item={selected} busy={busy} showSearch={showOrderSearch} setShowSearch={setShowOrderSearch} orderQuery={orderQuery} setOrderQuery={setOrderQuery} results={orderResults} searchOrders={searchOrders} linkOrder={linkOrder} unlinkOrder={unlinkOrder} />
      </main>}
    </div>}
  </div>;
};

const OrderPanel = ({ item, busy, showSearch, setShowSearch, orderQuery, setOrderQuery, results, searchOrders, linkOrder, unlinkOrder }) => {
  const order = item.linkedOrder;
  return <section className={styles.orderPanel}><div className={styles.orderHeader}><div><span>Contexto comercial</span><h3>{order ? order.orderNumber : 'Sin pedido ligado'}</h3></div><button onClick={() => setShowSearch(!showSearch)}>{order ? 'Cambiar pedido' : 'Buscar pedido'}</button></div>
    {item.orderLink && !item.orderLink.confirmed && order && <div className={styles.suggestion}><b>Coincidencia sugerida ({item.orderLink.confidence}%)</b><p>Se encontró por {item.orderLink.method.replace('AUTO_','').toLowerCase()}. Confirma antes de tratarla como vínculo definitivo.</p><button onClick={() => linkOrder(order.id)} disabled={busy}>Confirmar vínculo</button></div>}
    {order ? <><dl><div><dt>Estado</dt><dd>{order.status}</dd></div><div><dt>Canal de venta</dt><dd>{order.salesChannel}</dd></div><div><dt>Total</dt><dd>{money.format(order.totalPrice || 0)}</dd></div><div><dt>Cliente</dt><dd>{order.customer?.name || 'Sin nombre'}<small>{order.customer?.email}</small></dd></div></dl><div className={styles.items}><h4>Productos</h4>{order.items.map((entry) => <div key={entry.id}><span>{entry.qty} × {entry.name}</span><b>{entry.sku || 'Sin SKU'}</b></div>)}</div>{item.orderLink?.confirmed && item.orderLink?.method === 'MANUAL' && <button className={styles.unlink} onClick={unlinkOrder} disabled={busy}>Quitar vínculo manual</button>}</> : <p className={styles.muted}>Busca por número de pedido, cliente, SKU o folio externo para relacionar esta conversación de forma segura.</p>}
    {showSearch && <div className={styles.orderSearch}><div><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchOrders(); }} placeholder="Ej. MELI-2000..., correo o SKU" /><button onClick={searchOrders} disabled={busy}>Buscar</button></div>{results.map((candidate) => <button key={candidate.id} className={styles.orderResult} onClick={() => linkOrder(candidate.id)}><span><b>{candidate.orderNumber}</b><small>{candidate.customer?.name} · {candidate.status}</small></span><strong>{money.format(candidate.totalPrice || 0)}</strong></button>)}</div>}
  </section>;
};

export default UnifiedInboxScreen;
