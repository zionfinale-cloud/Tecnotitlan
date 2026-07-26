import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const formatDate = (date) => {
  if (!date) return 'Sin dato';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
};

const statusLabels = {
  SENT: 'Procesado',
  SKIPPED: 'Recibido / omitido',
  FAILED: 'Error',
  PENDING: 'Pendiente',
};

const statusColors = {
  SENT: { background: '#dcfce7', color: '#166534' },
  SKIPPED: { background: '#fef3c7', color: '#92400e' },
  FAILED: { background: '#fee2e2', color: '#991b1b' },
  PENDING: { background: '#e0f2fe', color: '#075985' },
};

const importActionLabels = {
  created: 'Importado a pedidos',
  existing: 'Ya existia',
  skipped: 'Requiere revision',
  failed: 'Error al importar',
};

const importActionColors = {
  created: { background: '#dcfce7', color: '#166534' },
  existing: { background: '#e0f2fe', color: '#075985' },
  skipped: { background: '#fef3c7', color: '#92400e' },
  failed: { background: '#fee2e2', color: '#991b1b' },
};

const MercadoLibreSettingsScreen = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [orders, setOrders] = useState([]);
  const [importResults, setImportResults] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);

  const callbackMessage = useMemo(() => {
    if (searchParams.get('connected') === '1') {
      return { type: 'success', text: 'Mercado Libre conectado correctamente.' };
    }
    if (searchParams.get('connected') === '0') {
      return { type: 'error', text: searchParams.get('error') || 'No se pudo conectar Mercado Libre.' };
    }
    return null;
  }, [searchParams]);

  const loadStatus = async () => {
    setLoading(true);
    setMessage(callbackMessage);
    try {
      const [statusResponse, webhookResponse] = await Promise.all([
        api.get('/mercadolibre/status'),
        api.get('/mercadolibre/webhook-events?limit=12').catch(() => ({ data: { data: [] } })),
      ]);
      setStatus(statusResponse.data.data);
      setWebhookEvents(webhookResponse.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar Mercado Libre.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const { data } = await api.get('/mercadolibre/auth-url');
      window.location.href = data.data.authUrl;
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo iniciar la conexion con Mercado Libre.' });
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar Mercado Libre de Tecnotitlan?')) return;
    setWorking(true);
    setMessage(null);
    try {
      await api.delete('/mercadolibre/disconnect');
      setMessage({ type: 'success', text: 'Mercado Libre desconectado.' });
      setOrders([]);
      await loadStatus();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo desconectar Mercado Libre.' });
    } finally {
      setWorking(false);
    }
  };

  const loadOrders = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const { data } = await api.get('/mercadolibre/orders');
      setOrders(data.data?.orders || []);
      setImportResults(data.data?.imports || []);
      const imported = (data.data?.imports || []).filter((item) => ['created', 'existing'].includes(item.action)).length;
      const review = (data.data?.imports || []).filter((item) => ['skipped', 'failed'].includes(item.action)).length;
      setMessage({
        type: review > 0 ? 'error' : 'success',
        text: `Pedidos leidos: ${data.data?.count || 0}. Importados/en pedidos: ${imported}. Por revisar: ${review}.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudieron leer pedidos de Mercado Libre.' });
    } finally {
      setWorking(false);
    }
  };

  const refreshWebhookEvents = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const { data } = await api.get('/mercadolibre/webhook-events?limit=12');
      setWebhookEvents(data.data || []);
      setMessage({ type: 'success', text: `Webhooks recibidos: ${(data.data || []).length}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo leer la bitacora de webhooks.' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div>Cargando Mercado Libre...</div>;

  const integration = status?.integration;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Mercado Libre</h2>
          <p className={styles.subtitle}>
            Fase 1: conectar cuenta, guardar tokens y preparar lectura de pedidos. La publicacion automatica queda para la siguiente fase.
          </p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={connect} disabled={working || !status?.isConfigured}>
          {working ? 'Abriendo...' : status?.isConnected ? 'Reconectar Meli' : 'Conectar Meli'}
        </button>
      </div>

      {message && <div className={`${styles.notice} ${message.type === 'success' ? styles.success : styles.error}`}>{message.text}</div>}

      {!status?.isConfigured && (
        <div className={`${styles.notice} ${styles.error}`}>
          Primero configura MERCADOLIBRE_APP_ID, MERCADOLIBRE_CLIENT_SECRET y MERCADOLIBRE_REDIRECT_URI en Sistema.
        </div>
      )}

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Estado de conexion</h3>
        {status?.isConnected ? (
          <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
            <div>
              <strong>Estado</strong>
              <p className={styles.subtitle}>Conectado</p>
            </div>
            <div>
              <strong>Cuenta</strong>
              <p className={styles.subtitle}>{integration?.nickname || 'Mercado Libre'}</p>
            </div>
            <div>
              <strong>Meli User ID</strong>
              <p className={styles.subtitle}>{integration?.meliUserId || 'Sin dato'}</p>
            </div>
            <div>
              <strong>Token vence</strong>
              <p className={styles.subtitle}>{formatDate(integration?.expiresAt)}</p>
            </div>
          </div>
        ) : (
          <p className={styles.subtitle} style={{ marginTop: '1rem' }}>
            Aun no esta conectado. Revisa las credenciales y presiona Conectar Meli.
          </p>
        )}
      </section>

      <section className={styles.card} style={{ marginTop: '1rem' }}>
        <h3 className={styles.cardTitle}>Redirect URI para Mercado Libre</h3>
        <p className={styles.subtitle}>Pega exactamente esta URL en la app de Mercado Libre Developers:</p>
        <code style={{ display: 'block', marginTop: '.75rem', padding: '1rem', background: '#f1f5f9', borderRadius: '12px' }}>
          {status?.redirectUri || 'https://api.tecnotitlan.com.mx/api/mercadolibre/callback'}
        </code>
      </section>

      <section className={styles.card} style={{ marginTop: '1rem' }}>
        <h3 className={styles.cardTitle}>Webhook / Notificaciones</h3>
        <p className={styles.subtitle}>Usalo para notificaciones de pedidos cuando Mercado Libre lo solicite.</p>
        <code style={{ display: 'block', marginTop: '.75rem', padding: '1rem', background: '#f1f5f9', borderRadius: '12px' }}>
          {status?.notificationsUrl || 'https://api.tecnotitlan.com.mx/api/mercadolibre/notifications'}
        </code>
      </section>

      <section className={styles.card} style={{ marginTop: '1rem' }}>
        <div className={styles.header} style={{ padding: 0, marginBottom: '.75rem' }}>
          <div>
            <h3 className={styles.cardTitle}>Ultimos webhooks recibidos</h3>
            <p className={styles.subtitle}>
              Aqui veras simulaciones y eventos reales. Mercado Pago puede responder 200 OK aunque no sea una orden de Mercado Libre.
            </p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={refreshWebhookEvents} disabled={working}>
            Actualizar bitacora
          </button>
        </div>

        {webhookEvents.length === 0 ? (
          <p className={styles.subtitle}>Aun no hay webhooks registrados en Tecnotitlan.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Evento</th>
                  <th>Cuenta / usuario</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {webhookEvents.map((event) => {
                  const badgeStyle = statusColors[event.status] || statusColors.PENDING;
                  return (
                    <tr key={event.id}>
                      <td>{formatDate(event.createdAt)}</td>
                      <td>
                        <span style={{ ...badgeStyle, display: 'inline-flex', borderRadius: '999px', padding: '.25rem .6rem', fontWeight: 900 }}>
                          {statusLabels[event.status] || event.status}
                        </span>
                      </td>
                      <td>{event.event}</td>
                      <td>{event.recipient || 'Sin dato'}</td>
                      <td>{event.message || event.error || 'Sin detalle'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card} style={{ marginTop: '1rem' }}>
        <div className={styles.header} style={{ padding: 0 }}>
          <div>
            <h3 className={styles.cardTitle}>Prueba de pedidos</h3>
            <p className={styles.subtitle}>Lee los pedidos recientes de Mercado Libre para confirmar que el token funciona.</p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={loadOrders} disabled={working || !status?.isConnected}>
            Leer pedidos
          </button>
        </div>

        {orders.length === 0 ? (
          <p className={styles.subtitle} style={{ marginTop: '1rem' }}>Aun no hay pedidos cargados.</p>
        ) : (
          <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
            {orders.slice(0, 10).map((order) => (
              <div key={order.id} style={{ border: '1px solid #dbe4ee', borderRadius: '12px', padding: '.85rem' }}>
                <strong>Orden {order.id}</strong>
                <p className={styles.subtitle}>
                  Estado: {order.status || 'Sin estado'} - Total: ${order.total_amount || 0}
                </p>
              </div>
            ))}
          </div>
        )}

        {importResults.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 className={styles.cardTitle}>Resultado de importacion</h4>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Orden Meli</th>
                    <th>Resultado</th>
                    <th>Pedido Tecnotitlan</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {importResults.map((result) => {
                    const badgeStyle = importActionColors[result.action] || statusColors.PENDING;
                    const unmatched = result.unmatched || [];
                    return (
                      <tr key={`${result.externalOrderId}-${result.action}`}>
                        <td>{result.externalOrderId || 'Sin dato'}</td>
                        <td>
                          <span style={{ ...badgeStyle, display: 'inline-flex', borderRadius: '999px', padding: '.25rem .6rem', fontWeight: 900 }}>
                            {importActionLabels[result.action] || result.action}
                          </span>
                        </td>
                        <td>
                          {result.order?.orderNumber ? (
                            <strong>{result.order.orderNumber}</strong>
                          ) : (
                            <span className={styles.subtitle}>No creado</span>
                          )}
                        </td>
                        <td>
                          {result.error && <span>{result.error}</span>}
                          {result.inventoryWarning && <span>{result.inventoryWarning}</span>}
                          {!result.error && !result.inventoryWarning && result.action === 'skipped' && (
                            <span>
                              No se importo porque la publicacion/producto de Mercado Libre no esta vinculada a un SKU local.
                              Vincula el item en el producto antes de sincronizar.
                            </span>
                          )}
                          {unmatched.length > 0 && (
                            <div className={styles.subtitle} style={{ marginTop: '.35rem' }}>
                              Sin empatar: {unmatched.map((item) => item.title || item.itemId || item.sku || 'Producto Meli').join(', ')}
                            </div>
                          )}
                          {!result.error && !result.inventoryWarning && result.action !== 'skipped' && (
                            <span>Listo para operar desde Pedidos.</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {status?.isConnected && (
        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={disconnect} disabled={working}>
            Desconectar Mercado Libre
          </button>
        </div>
      )}
    </div>
  );
};

export default MercadoLibreSettingsScreen;
