import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import api from '../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
import styles from './OrderScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const paymentLabels = {
  BANK_TRANSFER: 'Transferencia bancaria / SPEI',
  MERCADO_LIBRE: 'Pago por Mercado Libre',
  WHATSAPP: 'Confirmar por WhatsApp',
  Stripe: 'Tarjeta de credito/debito',
  PayPal: 'PayPal',
};

const paymentInstructions = {
  BANK_TRANSFER: [
    'Tu pedido esta apartado y pendiente de pago.',
    'Te compartiremos los datos SPEI para confirmar la compra.',
    'Puedes enviar el comprobante a hola@tecnotitlan.com.mx.',
  ],
  MERCADO_LIBRE: [
    'Tu pedido esta registrado.',
    'El equipo Tecnotitlan te dara seguimiento para pagarlo por Mercado Libre.',
  ],
  WHATSAPP: [
    'Tu pedido esta registrado para atencion manual.',
    'Te contactaremos para resolver dudas y confirmar el pago.',
  ],
  Stripe: [
    'Tu pedido esta pendiente de pago con tarjeta.',
    'Puedes continuar al pago seguro con tarjeta desde el boton de esta pantalla.',
  ],
};

const OrderScreen = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const loadOrder = async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data.order);
    } catch (err) {
      if (!silent) {
        setError('No pudimos cargar este pedido.');
      }
    }
  };

  useEffect(() => {
    loadOrder();
    const interval = setInterval(() => {
      loadOrder({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <Container className={styles.page}><div className={styles.notice}>{error}</div></Container>;
  if (!order) return <Container className={styles.page}><div className={styles.notice}>Consultando seguimiento...</div></Container>;

  const trackingNumber = order.shippingInfo?.trackingNumber;
  const instructions = paymentInstructions[order.paymentMethod] || ['El pago esta pendiente de confirmacion.'];

  return (
    <Container className={styles.page}>
      <Link to="/profile#orders" className={styles.back}>Volver a mis pedidos</Link>
      <header>
        <span>Seguimiento del pedido</span>
        <h1>{order.orderNumber}</h1>
        <p>Estado actual: <strong>{order.status}</strong></p>
      </header>

      <div className={styles.grid}>
        <section>
          <h2>Envio</h2>
          <p>{trackingNumber ? `Guia: ${trackingNumber}` : 'La guia aparecera aqui cuando el pedido sea enviado.'}</p>
          <p>{order.isDelivered ? 'Pedido entregado.' : 'Seguiremos actualizando esta seccion durante el envio.'}</p>
        </section>
        <section>
          <h2>Resumen</h2>
          <p>Metodo de pago: {paymentLabels[order.paymentMethod] || order.paymentMethod}</p>
          <p>Total: <strong>{currency.format(order.totalPrice || 0)}</strong></p>
          <p>{order.isPaid ? 'Pago confirmado.' : 'Pago pendiente de confirmacion.'}</p>
        </section>
      </div>

      {!order.isPaid && (
        <section className={styles.paymentBox}>
          <h2>Siguiente paso</h2>
          {instructions.map((line) => <p key={line}>{line}</p>)}
          {order.paymentMethod === 'Stripe' && (
            <Link className={styles.payButton} to={`/order/${order.id}/pay`}>Pagar con tarjeta</Link>
          )}
        </section>
      )}

      <section className={styles.items}>
        <h2>Productos</h2>
        {order.orderItems.map((item) => (
          <article key={item.id}>
            <img
              src={resolveAssetUrl(item.image)}
              alt=""
              onError={(event) => { event.currentTarget.src = FALLBACK_PRODUCT_IMAGE; }}
            />
            <span>
              {item.name}
              <small>{item.qty} x {currency.format(item.price || 0)}</small>
            </span>
          </article>
        ))}
      </section>
    </Container>
  );
};

export default OrderScreen;
