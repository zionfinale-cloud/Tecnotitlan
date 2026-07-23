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

const statusLabels = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PROCESSING: 'Preparando pedido',
  PENDING_FULFILLMENT: 'Por surtir',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const paidProgressStatuses = new Set(['PROCESSING', 'PENDING_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
const cancellableStatuses = new Set(['PENDING_PAYMENT', 'PROCESSING', 'PENDING_FULFILLMENT']);

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const toPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const buildTimelineEntries = (order) => {
  const entries = [...(order.statusHistory || [])];
  const hasPaidEvent = entries.some((entry) => {
    const notes = String(entry.notes || '').toLowerCase();
    return notes.includes('pago confirmado') || (order.isPaid && paidProgressStatuses.has(entry.status));
  });

  if (order.isPaid && order.paidAt && !hasPaidEvent) {
    entries.push({
      id: `paid-${order.id}`,
      status: order.status === 'PENDING_PAYMENT' ? 'PROCESSING' : order.status,
      notes: 'Pago confirmado. Pedido en preparacion.',
      date: order.paidAt,
    });
  }

  return entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
};

const getRefundNotice = (order) => {
  const paymentResult = toPlainObject(order.paymentResult);
  if (paymentResult.refund?.id) {
    return 'Reembolso solicitado en Stripe. El banco puede tardar algunos dias habiles en reflejarlo.';
  }
  if (paymentResult.refundStatus) {
    return `Reembolso en estado: ${paymentResult.refundStatus}.`;
  }
  return '';
};

const OrderScreen = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [cancelling, setCancelling] = useState(false);

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

  const requestCancellation = async () => {
    const confirmMessage = order.isPaid
      ? 'Vamos a cancelar el pedido y solicitar el reembolso si aun no tiene envio registrado. ¿Continuamos?'
      : 'Vamos a cancelar este pedido. ¿Continuamos?';

    if (!window.confirm(confirmMessage)) return;

    setCancelling(true);
    setActionError('');
    setActionMessage('');
    try {
      const { data } = await api.put(`/orders/${order.id}/cancel`);
      setOrder(data.data.order);
      setActionMessage(data.data.refund?.customerNote || 'Pedido cancelado correctamente.');
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos cancelar este pedido automaticamente.');
    } finally {
      setCancelling(false);
    }
  };

  if (error) return <Container className={styles.page}><div className={styles.notice}>{error}</div></Container>;
  if (!order) return <Container className={styles.page}><div className={styles.notice}>Consultando seguimiento...</div></Container>;

  const trackingNumber = order.shippingInfo?.trackingNumber;
  const carrier = order.shippingInfo?.carrier;
  const trackingUrl = order.shippingInfo?.trackingUrl;
  const instructions = paymentInstructions[order.paymentMethod] || ['El pago esta pendiente de confirmacion.'];
  const timelineEntries = buildTimelineEntries(order);
  const refundNotice = getRefundNotice(order);
  const canCancel = cancellableStatuses.has(order.status);

  return (
    <Container className={styles.page}>
      <Link to="/profile#orders" className={styles.back}>Volver a mis pedidos</Link>
      <header>
        <span>Seguimiento del pedido</span>
        <h1>{order.orderNumber}</h1>
        <p>Estado actual: <strong>{statusLabels[order.status] || order.status}</strong></p>
      </header>

      <div className={styles.grid}>
        <section>
          <h2>Envio</h2>
          <p>{trackingNumber ? `Guia: ${trackingNumber}` : 'La guia aparecera aqui cuando el pedido sea enviado.'}</p>
          {carrier && <p>Paqueteria: <strong>{carrier}</strong></p>}
          {trackingUrl && (
            <a className={styles.trackingLink} href={trackingUrl} target="_blank" rel="noreferrer">
              Abrir rastreo de paqueteria
            </a>
          )}
          <p>{order.isDelivered ? 'Pedido entregado.' : 'Seguiremos actualizando esta seccion durante el envio.'}</p>
        </section>
        <section>
          <h2>Resumen</h2>
          <p>Metodo de pago: {paymentLabels[order.paymentMethod] || order.paymentMethod}</p>
          <p>Total: <strong>{currency.format(order.totalPrice || 0)}</strong></p>
          <p>{order.isPaid ? 'Pago confirmado.' : 'Pago pendiente de confirmacion.'}</p>
          {refundNotice && <p className={styles.refundNote}>{refundNotice}</p>}
          {actionMessage && <p className={styles.actionNotice}>{actionMessage}</p>}
          {actionError && <p className={styles.actionError}>{actionError}</p>}
          {canCancel && (
            <button
              type="button"
              className={styles.cancelButton}
              onClick={requestCancellation}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelando...' : order.isPaid ? 'Cancelar y solicitar reembolso' : 'Cancelar pedido'}
            </button>
          )}
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

      <section className={styles.timelineBox}>
        <h2>Linea de tiempo</h2>
        <ol>
          {timelineEntries.length > 0 ? (
            timelineEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{statusLabels[entry.status] || entry.status}</strong>
                <span>{entry.notes || 'Estado actualizado.'}</span>
                <small>{entry.date ? dateFormat.format(new Date(entry.date)) : ''}</small>
              </li>
            ))
          ) : (
            <li>
              <strong>{statusLabels[order.status] || order.status}</strong>
              <span>Tu pedido ya esta registrado. Pronto veras mas actualizaciones aqui.</span>
            </li>
          )}
        </ol>
      </section>

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
