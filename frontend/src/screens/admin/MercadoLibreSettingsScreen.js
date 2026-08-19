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
  const [products, setProducts] = useState([]);
  const [linkSelections, setLinkSelections] = useState({});
  const [linkingItemId, setLinkingItemId] = useState(null);
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

  const unmatchedItems = useMemo(() => {
    const itemsById = new Map();
    importResults.flatMap((result) => result.unmatched || []).forEach((item) => {
      const itemId = String(item.itemId || '').trim().toUpperCase();
      if (itemId && !itemsById.has(itemId)) {
        itemsById.set(itemId, { ...item, itemId });
      }
    });
    return Array.from(itemsById.values());
  }, [importResults]);

  const loadStatus = async () => {
    setLoading(true);
    setMessage(callbackMessage);
    try {
      const [statusResponse, webhookResponse, productsResponse] = await Promise.all([
        api.get('/mercadolibre/status'),
        api.get('/mercadolibre/webhook-events?limit=12').catch(() => ({ data: { data: [] } })),
        api.get('/products', { params: { pageSize: 250, sortBy: 'createdAt_desc' } }),
      ]);
      setStatus(statusResponse.data.data);
      setWebhookEvents(webhookResponse.data.data || []);
      setProducts(productsResponse.data?.data?.products || []);
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

  const applyOrderSync = (payload = {}, prefix = '') => {
    const nextOrders = payload.orders || [];
    const nextImports = payload.imports || [];
    const imported = nextImports.filter((item) => ['created', 'existing'].includes(item.action)).length;
    const review = nextImports.filter((item) => item.action === 'skipped').length;
    const failed = nextImports.filter((item) => item.action === 'failed').length;

    setOrders(nextOrders);
    setImportResults(nextImports);
    setMessage({
      type: failed > 0 ? 'error' : review > 0 ? 'warning' : 'success',
      text: [
        prefix,
        `Pedidos leidos: ${payload.count || 0}. Importados/en pedidos: ${imported}. Por vincular: ${review}. Errores: ${failed}.`,
      ].filter(Boolean).join(' '),
    });
  };

  const loadOrders = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const { data } = await api.get('/mercadolibre/orders');
      applyOrderSync(data.data);
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

  const linkProductAndImport = async (item) => {
    const productId = linkSelections[item.itemId];
    if (!productId) {
      setMessage({ type: 'warning', text: `Selecciona el producto local que corresponde a ${item.title || item.itemId}.` });
      return;
    }

    setWorking(true);
    setLinkingItemId(item.itemId);
    setMessage(null);
    try {
      const selectedProduct = products.find((product) => product.id === productId);
      await api.put(`/products/${encodeURIComponent(productId)}/link-meli`, { meliItemId: item.itemId });

      const [{ data: ordersResponse }, { data: webhookResponse }] = await Promise.all([
        api.get('/mercadolibre/orders'),
        api.get('/mercadolibre/webhook-events?limit=12').catch(() => ({ data: { data: [] } })),
      ]);
      setWebhookEvents(webhookResponse.data || []);
      applyOrderSync(
        ordersResponse.data,
        `Publicacion ${item.itemId} vinculada a ${selectedProduct?.sku || 'producto local'}.`,
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || `No se pudo vincular la publicacion ${item.itemId}.`,
      });
    } finally {
      setLinkingItemId(null);
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
            Conecta la cuenta, vincula publicaciones con productos locales e importa pedidos sin duplicarlos.
          </p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={connect} disabled={working || !status?.isConfigured}>
          {working ? 'Abriendo...' : status?.isConnected ? 'Reconectar Meli' : 'Conectar Meli'}
        </button>
      </div>

      {message && (
        <div className={`${styles.notice} ${
          message.type === 'success' ? styles.success : message.type === 'warning' ? styles.warning : styles.error
        }`}>
          {message.text}
        </div>
      )}

      {status?.isConfigured === false && (
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
                              Usa el asistente de vinculacion que aparece debajo.
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

        {unmatchedItems.length > 0 && (
          <div className={styles.mappingPanel}>
            <div>
              <h4 className={styles.cardTitle}>Ventas pendientes de vincular</h4>
              <p className={styles.subtitle}>
                Elige a que producto de Tecnotitlan corresponde cada publicacion. Al vincularla se vuelven a leer los pedidos,
                se crean en Pedidos, se aplica inventario y se avisa al equipo.
              </p>
            </div>

            <div className={styles.mappingList}>
              {unmatchedItems.map((item) => (
                <div className={styles.mappingRow} key={item.itemId}>
                  <div className={styles.mappingCopy}>
                    <strong>{item.title || 'Publicacion de Mercado Libre'}</strong>
                    <span>Item: {item.itemId}</span>
                    {item.skuCandidates?.length > 0 && (
                      <span>Referencias recibidas: {item.skuCandidates.join(', ')}</span>
                    )}
                  </div>
                  <div className={styles.mappingControls}>
                    <select
                      className={styles.select}
                      value={linkSelections[item.itemId] || ''}
                      onChange={(event) => setLinkSelections((current) => ({
                        ...current,
                        [item.itemId]: event.target.value,
                      }))}
                      disabled={working}
                    >
                      <option value="">Selecciona un producto local</option>
                      {products.map((product) => (
                        <option value={product.id} key={product.id}>
                          {product.sku} - {product.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => linkProductAndImport(item)}
                      disabled={working || !linkSelections[item.itemId]}
                    >
                      {linkingItemId === item.itemId ? 'Vinculando...' : 'Vincular e importar'}
                    </button>
                  </div>
                </div>
              ))}
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
