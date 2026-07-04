import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import api from '../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
import styles from './OrderScreen.module.css';

const OrderScreen = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data.data.order))
      .catch(() => setError('No pudimos cargar este pedido.'));
  }, [id]);

  if (error) return <Container className={styles.page}><div className={styles.notice}>{error}</div></Container>;
  if (!order) return <Container className={styles.page}><div className={styles.notice}>Consultando seguimiento...</div></Container>;

  const trackingNumber = order.shippingInfo?.trackingNumber;
  return (
    <Container className={styles.page}>
      <Link to="/profile#orders" className={styles.back}>← Volver a mis pedidos</Link>
      <header><span>Seguimiento del pedido</span><h1>{order.orderNumber}</h1><p>Estado actual: <strong>{order.status}</strong></p></header>
      <div className={styles.grid}>
        <section><h2>Envío</h2><p>{trackingNumber ? `Guía: ${trackingNumber}` : 'La guía aparecerá aquí cuando el pedido sea enviado.'}</p><p>{order.isDelivered ? 'Pedido entregado.' : 'Seguiremos actualizando esta sección durante el envío.'}</p></section>
        <section><h2>Resumen</h2><p>Método de pago: {order.paymentMethod}</p><p>Total: <strong>${order.totalPrice.toFixed(2)}</strong></p></section>
      </div>
      <section className={styles.items}><h2>Productos</h2>{order.orderItems.map(item => <article key={item.id}><img src={resolveAssetUrl(item.image)} alt="" onError={(event) => { event.currentTarget.src = FALLBACK_PRODUCT_IMAGE; }} /><span>{item.name}<small>{item.qty} × ${item.price.toFixed(2)}</small></span></article>)}</section>
    </Container>
  );
};

export default OrderScreen;
