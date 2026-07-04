import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING_PAYMENT', label: 'Pendiente de pago' },
  { value: 'PROCESSING', label: 'En proceso' },
  { value: 'PENDING_FULFILLMENT', label: 'Por surtir' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const statusLabel = STATUS_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

const paymentLabels = {
  BANK_TRANSFER: 'Transferencia / SPEI',
  MERCADO_LIBRE: 'Mercado Libre',
  WHATSAPP: 'WhatsApp',
  Stripe: 'Stripe',
  PayPal: 'PayPal',
};

const OrderListScreen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [trackingByOrder, setTrackingByOrder] = useState({});

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateOrder = async (orderId, payload, message) => {
    setSavingId(orderId);
    setError('');
    setSuccess('');
    try {
      await api.put(`/orders/${orderId}/status`, payload);
      setSuccess(message);
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar el pedido.');
    } finally {
      setSavingId('');
    }
  };

  const deliverOrder = async (orderId) => {
    setSavingId(orderId);
    setError('');
    setSuccess('');
    try {
      await api.put(`/orders/${orderId}/deliver`);
      setSuccess('Pedido marcado como entregado.');
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo marcar como entregado.');
    } finally {
      setSavingId('');
    }
  };

  const confirmPayment = async (order) => {
    setSavingId(order.id);
    setError('');
    setSuccess('');
    try {
      await api.put(`/orders/${order.id}/pay`, {
        paymentResult: {
          id: `manual-${order.orderNumber}`,
          status: 'COMPLETED',
          update_time: new Date().toISOString(),
          payer: { email_address: order.user?.email || '' },
        },
      });
      setSuccess(`Pago confirmado para ${order.orderNumber}.`);
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo confirmar el pago.');
    } finally {
      setSavingId('');
    }
  };

  const customerName = (order) => {
    const fullName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ');
    return fullName || order.user?.email || 'Cliente';
  };

  const formatDate = (value) => {
    if (!value) return 'Pendiente';
    return dateFormat.format(new Date(value));
  };

  const submitTracking = (event, order) => {
    event.preventDefault();
    const trackingNumber = (trackingByOrder[order.id] || '').trim();
    if (!trackingNumber) {
      setError('Captura el numero de guia antes de marcar el pedido como enviado.');
      return;
    }
    updateOrder(order.id, { trackingNumber }, 'Guia registrada y pedido marcado como enviado.');
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Pedidos</h1>
          <p className={styles.subtitle}>
            Seguimiento operativo de ventas web: pago, surtido, guia y entrega.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={loadOrders} disabled={loading}>
          Actualizar
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <label className={styles.field} style={{ maxWidth: '260px' }}>
            <span className={styles.label}>Filtrar por estado</span>
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className={styles.muted}>
            {filteredOrders.length} de {orders.length} pedidos
          </span>
        </div>

        {loading ? (
          <div className={styles.empty}>Cargando pedidos...</div>
        ) : filteredOrders.length === 0 ? (
          <div className={styles.empty}>Aun no hay pedidos con este filtro.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Guia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                      <br />
                      <span className={styles.muted}>{formatDate(order.createdAt)}</span>
                    </td>
                    <td>
                      {customerName(order)}
                      <br />
                      <span className={styles.muted}>{order.user?.email || 'Sin correo'}</span>
                    </td>
                    <td>{currency.format(order.totalPrice || 0)}</td>
                    <td>{statusLabel[order.status] || order.status}</td>
                    <td>
                      {order.isPaid ? 'Pagado' : 'Pendiente'}
                      <br />
                      <span className={styles.muted}>{paymentLabels[order.paymentMethod] || order.paymentMethod}</span>
                    </td>
                    <td>
                      <form onSubmit={(event) => submitTracking(event, order)} className={styles.actions}>
                        <input
                          className={styles.input}
                          style={{ minWidth: '180px' }}
                          placeholder="Numero de guia"
                          value={trackingByOrder[order.id] || order.shippingInfo?.trackingNumber || ''}
                          onChange={(event) =>
                            setTrackingByOrder((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="submit"
                          className={styles.secondaryButton}
                          disabled={savingId === order.id}
                        >
                          Enviar
                        </button>
                      </form>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <select
                          className={styles.select}
                          value={order.status}
                          onChange={(event) =>
                            updateOrder(
                              order.id,
                              { status: event.target.value },
                              'Estado del pedido actualizado.'
                            )
                          }
                          disabled={savingId === order.id}
                        >
                          {STATUS_OPTIONS.filter((option) => option.value !== 'ALL').map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {!order.isPaid && (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => confirmPayment(order)}
                            disabled={savingId === order.id}
                          >
                            Confirmar pago
                          </button>
                        )}
                        {!order.isDelivered && (
                          <button
                            type="button"
                            className={styles.button}
                            onClick={() => deliverOrder(order.id)}
                            disabled={savingId === order.id}
                          >
                            Entregado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default OrderListScreen;
