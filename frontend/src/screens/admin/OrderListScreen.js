import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../../utils/assetUrl';
import styles from './OrderListScreen.module.css';

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
  { value: 'PROCESSING', label: 'Preparando' },
  { value: 'PENDING_FULFILLMENT', label: 'Por surtir' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const statusLabels = STATUS_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

const paymentLabels = {
  BANK_TRANSFER: 'Transferencia / SPEI',
  MERCADO_LIBRE: 'Mercado Libre',
  WHATSAPP: 'WhatsApp',
  Stripe: 'Tarjeta',
  PayPal: 'PayPal',
};

const statusTone = {
  PENDING_PAYMENT: 'warning',
  PROCESSING: 'info',
  PENDING_FULFILLMENT: 'info',
  SHIPPED: 'successTone',
  DELIVERED: 'successTone',
  CANCELLED: 'danger',
};

const getCustomerName = (order) => {
  const fullName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ');
  return fullName || order.user?.email || 'Cliente';
};

const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : 'Pendiente');

const INVENTORY_WARNING_TEXT = 'salida de inventario requiere revision manual';
const INVENTORY_RECOVERY_TEXT = 'Salida de inventario aplicada/reintentada correctamente';

const getInventoryIssue = (order) => {
  let issue = null;
  let resolved = false;

  (order.statusHistory || []).forEach((entry) => {
    const notes = entry.notes || '';
    if (notes.includes(INVENTORY_WARNING_TEXT)) {
      issue = entry;
      resolved = false;
    }
    if (notes.includes(INVENTORY_RECOVERY_TEXT)) {
      resolved = true;
    }
  });

  return { issue, isOpen: Boolean(issue) && !resolved };
};

const OrderListScreen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shippingByOrder, setShippingByOrder] = useState({});

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((order) => !order.isPaid).length;
    const preparing = orders.filter((order) => ['PROCESSING', 'PENDING_FULFILLMENT'].includes(order.status)).length;
    const shipped = orders.filter((order) => order.status === 'SHIPPED').length;
    return { total, pending, preparing, shipped };
  }, [orders]);

  const loadOrders = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los pedidos.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders({ silent: true }), 10000);
    return () => clearInterval(interval);
  }, []);

  const updateOrder = async (orderId, payload, message) => {
    setSavingId(orderId);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, payload);
      setOrders((current) => current.map((order) => (order.id === orderId ? data.data.order : order)));
      setSuccess(message);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar el pedido.');
    } finally {
      setSavingId('');
    }
  };

  const confirmPayment = async (order) => {
    setSavingId(order.id);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/orders/${order.id}/pay`, {
        paymentResult: {
          id: `manual-${order.orderNumber}`,
          status: 'COMPLETED',
          update_time: new Date().toISOString(),
          payer: { email_address: order.user?.email || '' },
        },
      });
      setOrders((current) => current.map((item) => (item.id === order.id ? data.data.order : item)));
      setSuccess(`Pago confirmado para ${order.orderNumber}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo confirmar el pago.');
    } finally {
      setSavingId('');
    }
  };

  const retryInventory = async (order) => {
    setSavingId(order.id);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/orders/${order.id}/retry-inventory`);
      setOrders((current) => current.map((item) => (item.id === order.id ? data.data.order : item)));
      setSuccess(`Inventario revisado para ${order.orderNumber}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo reintentar la salida de inventario.');
    } finally {
      setSavingId('');
    }
  };

  const submitShipping = (event, order) => {
    event.preventDefault();
    const shipping = shippingByOrder[order.id] || {};
    const trackingNumber = (shipping.trackingNumber || order.shippingInfo?.trackingNumber || '').trim();
    if (!trackingNumber) {
      setError('Captura el numero de guia antes de marcar el pedido como enviado.');
      return;
    }
    updateOrder(
      order.id,
      {
        trackingNumber,
        carrier: shipping.carrier || order.shippingInfo?.carrier || '',
        trackingUrl: shipping.trackingUrl || order.shippingInfo?.trackingUrl || '',
        shippingNotes: shipping.shippingNotes || order.shippingInfo?.notes || '',
      },
      'Guia registrada, pedido marcado como enviado y correo enviado al cliente.'
    );
  };

  const updateShippingDraft = (orderId, field, value) => {
    setShippingByOrder((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] || {}),
        [field]: value,
      },
    }));
  };

  return (
    <>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Operacion</span>
          <h1 className={styles.title}>Pedidos</h1>
          <p className={styles.subtitle}>Confirma pagos, registra guias y actualiza el seguimiento del cliente.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={() => loadOrders()} disabled={loading}>
          <i className="fas fa-sync-alt"></i> Actualizar
        </button>
      </div>

      <section className={styles.statsGrid}>
        <article><small>Total</small><strong>{stats.total}</strong></article>
        <article><small>Pago pendiente</small><strong>{stats.pending}</strong></article>
        <article><small>Por preparar</small><strong>{stats.preparing}</strong></article>
        <article><small>En camino</small><strong>{stats.shipped}</strong></article>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.filterBar}>
        <label className={styles.field}>
          <span>Filtrar por estado</span>
          <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <span className={styles.muted}>{filteredOrders.length} de {orders.length} pedidos</span>
      </div>

      {loading ? (
        <div className={styles.empty}>Cargando pedidos...</div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.empty}>Aun no hay pedidos con este filtro.</div>
      ) : (
        <div className={styles.orderStack}>
          {filteredOrders.map((order) => {
            const shipping = shippingByOrder[order.id] || {};
            const saving = savingId === order.id;
            const inventoryIssue = getInventoryIssue(order);
            return (
              <article key={order.id} className={styles.orderCard}>
                <div className={styles.orderTop}>
                  <div>
                    <span className={styles.eyebrow}>Pedido</span>
                    <h2>{order.orderNumber}</h2>
                    <p>{formatDate(order.createdAt)} · {getCustomerName(order)} · {order.user?.email || 'Sin correo'}</p>
                  </div>
                  <div className={styles.orderMoney}>
                    <strong>{currency.format(order.totalPrice || 0)}</strong>
                    <span>{paymentLabels[order.paymentMethod] || order.paymentMethod}</span>
                  </div>
                </div>

                <div className={styles.badges}>
                  <span className={`${styles.badge} ${styles[statusTone[order.status] || 'info']}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                  <span className={`${styles.badge} ${order.isPaid ? styles.successTone : styles.warning}`}>
                    {order.isPaid ? 'Pago confirmado' : 'Pago pendiente'}
                  </span>
                  {order.shippingInfo?.trackingNumber && (
                    <span className={`${styles.badge} ${styles.successTone}`}>
                      Guia {order.shippingInfo.trackingNumber}
                    </span>
                  )}
                </div>

                {inventoryIssue.isOpen && (
                  <div className={styles.inventoryAlert}>
                    <span>
                      <strong>Inventario pendiente de revisar</strong>
                      <small>{inventoryIssue.issue?.notes || 'La venta se cobro, pero no se pudo descontar stock.'}</small>
                    </span>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => retryInventory(order)}
                      disabled={saving}
                    >
                      Reintentar inventario
                    </button>
                  </div>
                )}

                <div className={styles.contentGrid}>
                  <section className={styles.panel}>
                    <h3>Productos</h3>
                    <div className={styles.itemList}>
                      {(order.orderItems || []).map((item) => (
                        <div key={item.id} className={styles.item}>
                          <img
                            src={resolveAssetUrl(item.image)}
                            alt=""
                            onError={(event) => { event.currentTarget.src = FALLBACK_PRODUCT_IMAGE; }}
                          />
                          <span>
                            <strong>{item.product?.sku ? `${item.product.sku} - ` : ''}{item.name}</strong>
                            <small>{item.qty} x {currency.format(item.price || 0)}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={styles.panel}>
                    <h3>Seguimiento</h3>
                    <ol className={styles.timeline}>
                      {(order.statusHistory || []).length > 0 ? (
                        order.statusHistory.map((entry) => (
                          <li key={entry.id}>
                            <strong>{statusLabels[entry.status] || entry.status}</strong>
                            <span>{entry.notes || 'Estado actualizado.'}</span>
                            <small>{formatDate(entry.date)}</small>
                          </li>
                        ))
                      ) : (
                        <li>
                          <strong>{statusLabels[order.status] || order.status}</strong>
                          <span>Historial inicial pendiente de registrar.</span>
                        </li>
                      )}
                    </ol>
                  </section>

                  <section className={styles.panel}>
                    <h3>Acciones</h3>
                    <div className={styles.actionGroup}>
                      {!order.isPaid && (
                        <button type="button" className={styles.primaryButton} onClick={() => confirmPayment(order)} disabled={saving}>
                          Confirmar pago
                        </button>
                      )}

                      <label className={styles.field}>
                        <span>Estado</span>
                        <select
                          className={styles.select}
                          value={order.status}
                          onChange={(event) => updateOrder(order.id, { status: event.target.value }, 'Estado del pedido actualizado.')}
                          disabled={saving}
                        >
                          {STATUS_OPTIONS.filter((option) => option.value !== 'ALL').map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <form onSubmit={(event) => submitShipping(event, order)} className={styles.shippingForm}>
                      <label className={styles.field}>
                        <span>Paqueteria</span>
                        <input
                          className={styles.input}
                          placeholder="DHL, FedEx, Estafeta..."
                          value={shipping.carrier ?? order.shippingInfo?.carrier ?? ''}
                          onChange={(event) => updateShippingDraft(order.id, 'carrier', event.target.value)}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Numero de guia</span>
                        <input
                          className={styles.input}
                          placeholder="Guia de envio"
                          value={shipping.trackingNumber ?? order.shippingInfo?.trackingNumber ?? ''}
                          onChange={(event) => updateShippingDraft(order.id, 'trackingNumber', event.target.value)}
                        />
                      </label>
                      <label className={`${styles.field} ${styles.fullField}`}>
                        <span>Link de rastreo</span>
                        <input
                          className={styles.input}
                          placeholder="https://..."
                          value={shipping.trackingUrl ?? order.shippingInfo?.trackingUrl ?? ''}
                          onChange={(event) => updateShippingDraft(order.id, 'trackingUrl', event.target.value)}
                        />
                      </label>
                      <div className={styles.buttonRow}>
                        <button type="submit" className={styles.secondaryButton} disabled={saving || !order.isPaid}>
                          Guardar guia
                        </button>
                        {!order.isDelivered && (
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => updateOrder(order.id, { status: 'DELIVERED' }, 'Pedido marcado como entregado.')}
                            disabled={saving || !order.isPaid}
                          >
                            Entregado
                          </button>
                        )}
                      </div>
                    </form>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
};

export default OrderListScreen;
