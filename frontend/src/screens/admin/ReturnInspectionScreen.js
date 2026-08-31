import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import { resolveAssetUrl } from '../../utils/assetUrl';
import styles from './ReturnInspectionScreen.module.css';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = (value) => value ? dateTime.format(new Date(value)) : 'Pendiente';
const statusLabels = { QUARANTINED: 'En cuarentena', INSPECTING: 'En inspección', READY_FOR_DECISION: 'Lista para dictamen', FINALIZED: 'Finalizada' };
const conditionLabels = { PENDING: 'Pendiente', SEALED_NEW: 'Nuevo sellado', LIKE_NEW: 'Como nuevo', USED_GOOD: 'Usado funcional', DAMAGED: 'Dañado', INCOMPLETE: 'Incompleto', WRONG_ITEM: 'Producto incorrecto' };
const dispositionLabels = { HOLD: 'Mantener en cuarentena', RESTOCK: 'Reintegrar a bodega', REFURBISH: 'Enviar a reacondicionamiento', RETURN_SUPPLIER: 'Devolver a proveedor', DISPOSE: 'Baja / disposición final' };
const emptyReception = { candidate: '', location: 'CUARENTENA-A1', packageCondition: '', sealedPackage: '', notes: '', evidence: [], quantities: {} };

const ReturnInspectionScreen = () => {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({});
  const [candidates, setCandidates] = useState({ claims: [], orders: [] });
  const [selectedId, setSelectedId] = useState('');
  const [showReception, setShowReception] = useState(false);
  const [reception, setReception] = useState(emptyReception);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [caseResponse, candidateResponse] = await Promise.all([api.get('/return-inspections'), api.get('/return-inspections/candidates')]);
      const next = caseResponse.data.data.cases || [];
      setCases(next); setStats(caseResponse.data.data.stats || {}); setCandidates(candidateResponse.data.data || { claims: [], orders: [] });
      setSelectedId((current) => next.some((entry) => entry.id === current) ? current : next[0]?.id || '');
    } catch (err) { setError(err.response?.data?.message || 'No se pudo cargar el centro de devoluciones.'); }
    finally { if (!silent) setLoading(false); }
  };

  useRealtimeRefresh(['returns', 'orders', 'inventory', 'meli'], () => load({ silent: true }));
  useEffect(() => { load(); }, []);
  const selected = cases.find((entry) => entry.id === selectedId) || cases[0];
  const candidateOptions = useMemo(() => {
    const claimOptions = (candidates.claims || []).filter((claim) => claim.order).map((claim) => ({ key: `claim:${claim.id}`, claimId: claim.id, order: claim.order, label: `ML ${claim.externalClaimId} · ${claim.order.orderNumber}` }));
    const seen = new Set(claimOptions.map((entry) => entry.order.id));
    const orderOptions = (candidates.orders || []).filter((order) => !seen.has(order.id)).map((order) => ({ key: `order:${order.id}`, order, label: `${order.orderNumber} · ${order.status}` }));
    return [...claimOptions, ...orderOptions];
  }, [candidates]);
  const chosenCandidate = candidateOptions.find((entry) => entry.key === reception.candidate);

  const run = async (request, message) => {
    setBusy(true); setError(''); setSuccess('');
    try { await request(); await load({ silent: true }); setSuccess(message); return true; }
    catch (err) { setError(err.response?.data?.message || 'No se pudo completar la operación.'); return false; }
    finally { setBusy(false); }
  };

  const uploadEvidence = async (files, onUploaded) => {
    setBusy(true); setError('');
    try {
      const uploaded = [];
      for (const file of [...files].slice(0, 12)) {
        const form = new FormData(); form.append('image', file);
        const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploaded.push(data.filePath);
      }
      onUploaded(uploaded);
    } catch (err) { setError(err.response?.data?.message || 'No se pudo subir la evidencia.'); }
    finally { setBusy(false); }
  };

  const receive = async (event) => {
    event.preventDefault();
    if (!chosenCandidate) return setError('Selecciona un pedido o devolución de Mercado Libre.');
    if (reception.evidence.length === 0) return setError('Sube al menos una foto del paquete antes de confirmar la recepción.');
    const items = chosenCandidate.order.orderItems.map((item) => ({ orderItemId: item.id, receivedQty: Number(reception.quantities[item.id] || 0) })).filter((item) => item.receivedQty > 0);
    const ok = await run(() => api.post('/return-inspections/receive', {
      orderId: chosenCandidate.order.id, claimId: chosenCandidate.claimId, quarantineLocation: reception.location,
      packageCondition: reception.packageCondition, sealedPackage: reception.sealedPackage === '' ? null : reception.sealedPackage === 'yes',
      receptionEvidence: reception.evidence, notes: reception.notes, items,
    }), 'Recepción registrada. Las piezas están aisladas y no aumentaron el stock vendible.');
    if (ok) { setReception(emptyReception); setShowReception(false); }
  };

  const changeItem = (itemId, field, value) => setCases((current) => current.map((entry) => entry.id !== selected.id ? entry : ({ ...entry, items: entry.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item) })));
  const changeChecklist = (item, field, value) => changeItem(item.id, 'checklist', { ...(item.checklist || {}), [field]: Boolean(value) });
  const saveItem = (item) => run(() => api.put(`/return-inspections/${selected.id}/items/${item.id}`, {
    inspectedQty: Number(item.inspectedQty), condition: item.condition, disposition: item.disposition,
    serialNumbers: item.serialNumbers || [], evidenceUrls: item.evidenceUrls || [], checklist: {
      serialMatches: Boolean(item.checklist?.serialMatches), accessoriesComplete: Boolean(item.checklist?.accessoriesComplete),
      powersOn: Boolean(item.checklist?.powersOn), cosmeticOk: Boolean(item.checklist?.cosmeticOk), packageOk: Boolean(item.checklist?.packageOk),
    }, notes: item.notes || '',
  }), 'Inspección guardada; la pieza continúa en cuarentena hasta el dictamen final.');
  const finalize = () => {
    if (!window.confirm('¿Aplicar el dictamen final? Sólo las piezas marcadas “Reintegrar a bodega” aumentarán el inventario vendible.')) return;
    run(() => api.post(`/return-inspections/${selected.id}/finalize`), 'Dictamen final aplicado sin duplicar inventario.');
  };

  if (loading) return <div className={styles.empty}>Preparando cuarentena de devoluciones...</div>;
  return <div className={styles.page}>
    <header className={styles.header}><div><span>Control físico seguro</span><h1>Inspección y cuarentena</h1><p>Nada regresa al inventario vendible sin recepción, evidencia y dictamen.</p></div><button onClick={() => setShowReception((value) => !value)}><i className="fas fa-box-open" /> Recibir devolución</button></header>
    {error && <div className={styles.error}>{error}</div>}{success && <div className={styles.success}>{success}</div>}
    <section className={styles.stats}><article><small>Expedientes</small><strong>{stats.total || 0}</strong></article><article><small>Casos en cuarentena</small><strong>{stats.quarantinedCases || 0}</strong></article><article><small>Piezas aisladas</small><strong>{stats.quarantinedUnits || 0}</strong></article><article><small>Listos para dictamen</small><strong>{stats.readyToFinalize || 0}</strong></article></section>
    {showReception && <ReceptionForm reception={reception} setReception={setReception} options={candidateOptions} candidate={chosenCandidate} receive={receive} busy={busy} uploadEvidence={uploadEvidence} />}
    {cases.length === 0 ? <div className={styles.empty}><i className="fas fa-shield-alt" /><h2>No hay piezas en cuarentena</h2><p>Usa “Recibir devolución” cuando llegue físicamente un paquete.</p></div> : <div className={styles.workspace}>
      <aside className={styles.list}>{cases.map((entry) => <button key={entry.id} className={entry.id === selected?.id ? styles.active : ''} onClick={() => setSelectedId(entry.id)}><span><b>{entry.caseNumber}</b><em data-status={entry.status}>{statusLabels[entry.status] || entry.status}</em></span><strong>{entry.order.orderNumber}</strong><small>{entry.items.reduce((sum, item) => sum + item.receivedQty, 0)} pieza(s) · {entry.quarantineLocation}</small><small>{fmtDate(entry.receivedAt)}</small></button>)}</aside>
      {selected && <main className={styles.detail}><section className={styles.caseHeader}><div><span>{selected.source} · {selected.caseNumber}</span><h2>Pedido {selected.order.orderNumber}</h2><p>{selected.order.user ? `${selected.order.user.firstName || ''} ${selected.order.user.lastName || ''}`.trim() : 'Cliente no disponible'} · recibido por {selected.receivedBy}</p></div><div><b>{statusLabels[selected.status] || selected.status}</b><small>{selected.quarantineLocation}</small></div></section>
        <section className={styles.safety}><i className="fas fa-lock" /><div><b>Stock bloqueado por cuarentena</b><p>Guardar una inspección no libera piezas. El inventario cambia únicamente al finalizar y sólo para destinos “Reintegrar a bodega”.</p></div></section>
        <section className={styles.items}>{selected.items.map((item) => <InspectionItem key={item.id} item={item} locked={selected.status === 'FINALIZED'} busy={busy} changeItem={changeItem} changeChecklist={changeChecklist} uploadEvidence={uploadEvidence} saveItem={saveItem} />)}</section>
        {selected.status !== 'FINALIZED' && <button className={styles.finalize} onClick={finalize} disabled={busy || selected.status !== 'READY_FOR_DECISION'}><i className="fas fa-clipboard-check" /> Aplicar dictamen final</button>}
      </main>}
    </div>}
  </div>;
};

const ReceptionForm = ({ reception, setReception, options, candidate, receive, busy, uploadEvidence }) => <form className={styles.reception} onSubmit={receive}><div className={styles.sectionTitle}><div><span>Paso 1</span><h2>Recepción física</h2></div><b>Todo entra a cuarentena</b></div><div className={styles.formGrid}><label>Pedido o devolución<select required value={reception.candidate} onChange={(event) => setReception({ ...reception, candidate: event.target.value, quantities: {} })}><option value="">Selecciona...</option>{options.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label><label>Ubicación de cuarentena<input required value={reception.location} onChange={(event) => setReception({ ...reception, location: event.target.value })} placeholder="Ej. CUARENTENA-A1" /></label><label>Condición del paquete<input value={reception.packageCondition} onChange={(event) => setReception({ ...reception, packageCondition: event.target.value })} placeholder="Golpeado, abierto, mojado..." /></label><label>¿Llegó sellado?<select value={reception.sealedPackage} onChange={(event) => setReception({ ...reception, sealedPackage: event.target.value })}><option value="">Sin confirmar</option><option value="yes">Sí</option><option value="no">No</option></select></label></div>{candidate && <div className={styles.receivedItems}><h3>Piezas recibidas</h3>{candidate.order.orderItems.map((item) => <label key={item.id}><span><b>{item.name}</b><small>{item.product?.sku || 'Sin SKU'} · vendido: {item.qty}</small></span><input type="number" min="0" max={item.qty} value={reception.quantities[item.id] || ''} onChange={(event) => setReception({ ...reception, quantities: { ...reception.quantities, [item.id]: event.target.value } })} placeholder="0" /></label>)}</div>}<label className={styles.full}>Evidencia al abrir el paquete<input type="file" accept="image/*" multiple onChange={(event) => uploadEvidence(event.target.files, (uploaded) => setReception((current) => ({ ...current, evidence: [...current.evidence, ...uploaded].slice(0, 12) })))} /><small>{reception.evidence.length} archivo(s) cargados</small></label><label className={styles.full}>Notas de recepción<textarea rows="3" value={reception.notes} onChange={(event) => setReception({ ...reception, notes: event.target.value })} placeholder="Quién entregó, daños visibles, diferencias de peso o empaque..." /></label><button disabled={busy}>Confirmar recepción en cuarentena</button></form>;

const InspectionItem = ({ item, locked, busy, changeItem, changeChecklist, uploadEvidence, saveItem }) => <article className={styles.inspectionItem}><div className={styles.itemTitle}><div><span>{item.product.sku}</span><h3>{item.orderItem.name}</h3><p>Recibidas: {item.receivedQty} de {item.expectedQty} · stock vendible actual: {item.product.countInStock}</p></div><b>{dispositionLabels[item.disposition]}</b></div><div className={styles.formGrid}><label>Cantidad inspeccionada<input type="number" min="0" max={item.receivedQty} disabled={locked} value={item.inspectedQty} onChange={(event) => changeItem(item.id, 'inspectedQty', event.target.value)} /></label><label>Condición<select disabled={locked} value={item.condition} onChange={(event) => changeItem(item.id, 'condition', event.target.value)}>{Object.entries(conditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.wide}>Destino seguro<select disabled={locked} value={item.disposition} onChange={(event) => changeItem(item.id, 'disposition', event.target.value)}>{Object.entries(dispositionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className={styles.checklist}><b>Lista de verificación</b>{[['serialMatches','Serie coincide'],['accessoriesComplete','Accesorios completos'],['powersOn','Enciende / funciona'],['cosmeticOk','Estado cosmético aceptable'],['packageOk','Empaque utilizable']].map(([field,label]) => <label key={field}><input type="checkbox" disabled={locked} checked={Boolean(item.checklist?.[field])} onChange={(event) => changeChecklist(item, field, event.target.checked)} /> {label}</label>)}</div><label>Números de serie (uno por línea)<textarea disabled={locked} rows="2" value={(item.serialNumbers || []).join('\n')} onChange={(event) => changeItem(item.id, 'serialNumbers', event.target.value.split('\n').map((value) => value.trim()).filter(Boolean))} /></label><label>Hallazgos<textarea disabled={locked} rows="3" value={item.notes || ''} onChange={(event) => changeItem(item.id, 'notes', event.target.value)} placeholder="Describe pruebas, faltantes, golpes, humedad, manipulación o motivo del dictamen..." /></label><div className={styles.evidence}><label><i className="fas fa-camera" /> Agregar evidencia<input type="file" accept="image/*" multiple disabled={locked || busy} onChange={(event) => uploadEvidence(event.target.files, (uploaded) => changeItem(item.id, 'evidenceUrls', [...(item.evidenceUrls || []), ...uploaded].slice(0, 12)))} /></label><div>{(item.evidenceUrls || []).map((url) => <a key={url} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer"><img src={resolveAssetUrl(url)} alt="Evidencia de devolución" /></a>)}</div></div>{!locked && <button onClick={() => saveItem(item)} disabled={busy}>Guardar inspección</button>}</article>;

export default ReturnInspectionScreen;
