import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/apiService';
import { useRealtime } from '../../context/RealtimeContext';
import styles from './MyWorkScreen.module.css';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

const MyWorkScreen = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { lastEvent } = useRealtime();
  const load = useCallback(() => api.get('/my-work').then((response) => setData(response.data.data)).catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo cargar tu trabajo.')), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (lastEvent?.topic && ['orders', 'inbox', 'messages', 'meli'].includes(lastEvent.topic)) load(); }, [lastEvent, load]);
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data) return <div className={styles.page}>Preparando tu espacio de trabajo...</div>;
  return <div className={styles.page}>
    <header><span>Prioridades de hoy</span><h1>Mi trabajo</h1><p>Lo que requiere atención según tu rol, ordenado para que sepas por dónde empezar.</p></header>
    <section className={styles.summary}>
      <Link to="/admin/inbox?pending=true"><strong>{data.summary.pending}</strong><span>Pendientes totales</span></Link>
      <Link to="/admin/orderlist"><strong>{data.summary.ordersToPrepare}</strong><span>Pedidos por preparar</span></Link>
      <Link to="/admin/inbox?section=IMPORTANT"><strong>{data.summary.urgentClaims}</strong><span>Reclamos urgentes</span></Link>
      <Link to="/admin/inbox?section=MESSAGES"><strong>{data.summary.unreadMessages}</strong><span>Mensajes sin respuesta</span></Link>
    </section>
    <section className={styles.grid}>
      <article className={styles.card}><div className={styles.cardHeader}><div><span>Operación</span><h2>Pedidos por preparar</h2></div><Link to="/admin/orderlist">Ver pedidos</Link></div>{data.orders.length ? <div className={styles.list}>{data.orders.map((order) => <Link to={`/admin/orderlist?order=${order.id}`} key={order.id}><div><strong>{order.orderNumber}</strong><span>{order.salesChannel} · {order.orderItems.reduce((sum, item) => sum + item.qty, 0)} piezas</span></div><b>{money.format(order.totalPrice)}</b></Link>)}</div> : <p className={styles.empty}>No hay pedidos esperando preparación.</p>}</article>
      <article className={styles.card}><div className={styles.cardHeader}><div><span>Atención inmediata</span><h2>Reclamos abiertos</h2></div><Link to="/admin/inbox?section=IMPORTANT">Abrir bandeja</Link></div>{data.claims.length ? <div className={styles.list}>{data.claims.map((claim) => <Link to={`/admin/inbox?section=IMPORTANT&claim=${claim.id}`} key={claim.id}><div><strong>{claim.order?.orderNumber || claim.externalClaimId}</strong><span>{claim.title || 'Reclamo de Mercado Libre'}</span></div><b className={styles.urgent}>{claim.priority}</b></Link>)}</div> : <p className={styles.empty}>No hay reclamos abiertos.</p>}</article>
    </section>
    <section className={styles.channels}><h2>Mensajes que esperan respuesta</h2><div><Link to="/admin/inbox?channel=whatsapp"><strong>{data.messages.whatsapp}</strong>WhatsApp</Link><Link to="/admin/inbox?channel=mercadolibre"><strong>{data.messages.questions + data.messages.postSale}</strong>Mercado Libre</Link><Link to="/admin/inbox?channel=support"><strong>{data.messages.support}</strong>Soporte</Link></div></section>
  </div>;
};

export default MyWorkScreen;
