import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const CHANNELS = [
  { value: 'MERCADOLIBRE', label: 'Mercado Libre' },
  { value: 'TIKTOK_SHOP', label: 'TikTok Shop' },
  { value: 'AMAZON', label: 'Amazon' },
];

const STATUS = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'READY', label: 'Listo para publicar' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'ERROR', label: 'Error' },
];

const ChannelsScreen = () => {
  const [products, setProducts] = useState([]);
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    productId: '',
    channel: 'MERCADOLIBRE',
    externalProductId: '',
    externalSku: '',
    title: '',
    price: '',
    publishedStock: '',
    stockBuffer: 0,
    commissionRate: '',
    shippingCostEstimate: '',
    status: 'DRAFT',
    notes: '',
  });

  const activeProducts = useMemo(
    () => products.filter((product) => !product.isArchived),
    [products]
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId),
    [form.productId, products]
  );

  const loadChannels = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsResponse, listingsResponse, summaryResponse] = await Promise.all([
        api.get('/products', { params: { pageSize: 250 } }),
        api.get('/marketplaces/listings'),
        api.get('/marketplaces/summary'),
      ]);

      setProducts(productsResponse.data.data.products || []);
      setListings(listingsResponse.data.data.listings || []);
      setSummary(summaryResponse.data.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los canales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const fillFromProduct = (productId) => {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      productId,
      externalSku: product?.sku || '',
      title: product?.name || '',
      price: product?.price || '',
      publishedStock: product ? Math.max(product.countInStock - Number(current.stockBuffer || 0), 0) : '',
    }));
  };

  const saveListing = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/marketplaces/listings', {
        ...form,
        price: form.price === '' ? undefined : Number(form.price),
        publishedStock: form.publishedStock === '' ? undefined : Number(form.publishedStock),
        stockBuffer: Number(form.stockBuffer || 0),
        commissionRate: form.commissionRate === '' ? undefined : Number(form.commissionRate),
        shippingCostEstimate: form.shippingCostEstimate === '' ? undefined : Number(form.shippingCostEstimate),
      });

      setSuccess('Publicacion de canal guardada.');
      setForm({
        productId: '',
        channel: 'MERCADOLIBRE',
        externalProductId: '',
        externalSku: '',
        title: '',
        price: '',
        publishedStock: '',
        stockBuffer: 0,
        commissionRate: '',
        shippingCostEstimate: '',
        status: 'DRAFT',
        notes: '',
      });
      await loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la publicacion.');
    }
  };

  const archiveListing = async (listing) => {
    if (!window.confirm(`Archivar publicacion ${listing.channel} de ${listing.product?.sku}?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/marketplaces/listings/${listing.id}`);
      setSuccess('Publicacion archivada.');
      await loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo archivar la publicacion.');
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Canales de venta</h1>
          <p className={styles.subtitle}>
            Prepara publicaciones por marketplace sin tocar el inventario maestro.
          </p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.card}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Nueva publicacion</h2>
        <form onSubmit={saveListing}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Producto maestro</label>
              <select
                className={styles.select}
                value={form.productId}
                onChange={(event) => fillFromProduct(event.target.value)}
                required
              >
                <option value="">Selecciona producto</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name} ({product.countInStock} disponibles)
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Canal</label>
              <select
                className={styles.select}
                value={form.channel}
                onChange={(event) => setForm({ ...form, channel: event.target.value })}
              >
                {CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>{channel.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Titulo publicado</label>
              <input
                className={styles.input}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={selectedProduct?.name || 'Nombre para marketplace'}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>SKU externo</label>
              <input
                className={styles.input}
                value={form.externalSku}
                onChange={(event) => setForm({ ...form, externalSku: event.target.value })}
                placeholder={selectedProduct?.sku || 'AUR-001'}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>ID externo</label>
              <input
                className={styles.input}
                value={form.externalProductId}
                onChange={(event) => setForm({ ...form, externalProductId: event.target.value })}
                placeholder="Se llena cuando exista en el marketplace"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Estado</label>
              <select
                className={styles.select}
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {STATUS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Precio por canal</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="349"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Stock publicado</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.publishedStock}
                onChange={(event) => setForm({ ...form, publishedStock: event.target.value })}
                placeholder="10"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Buffer de stock</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.stockBuffer}
                onChange={(event) => setForm({ ...form, stockBuffer: event.target.value })}
                placeholder="2"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Comision estimada</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.001"
                value={form.commissionRate}
                onChange={(event) => setForm({ ...form, commissionRate: event.target.value })}
                placeholder="0.16"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Envio estimado</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.shippingCostEstimate}
                onChange={(event) => setForm({ ...form, shippingCostEstimate: event.target.value })}
                placeholder="80"
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Condiciones, categoria marketplace, pendientes de publicacion..."
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit">Guardar publicacion</button>
          </div>
        </form>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Resumen</h2>
        <div className={styles.formGrid}>
          {CHANNELS.map((channel) => {
            const activeCount = (summary?.listingsByChannel || [])
              .filter((item) => item.channel === channel.value && item.status === 'ACTIVE')
              .reduce((total, item) => total + item._count._all, 0);
            return (
              <div className={styles.placeholderBox} key={channel.value}>
                <strong>{channel.label}:</strong> {activeCount} activas
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Publicaciones configuradas</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Canal</th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Precio</th>
                <th>Stock canal</th>
                <th>Stock real</th>
                <th>Estado</th>
                <th>Sync</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td>{listing.channel}</td>
                  <td>{listing.externalSku || listing.product?.sku}</td>
                  <td>{listing.title || listing.product?.name}</td>
                  <td>{currency.format(listing.price || 0)}</td>
                  <td>{listing.publishedStock ?? '-'}</td>
                  <td>{listing.product?.countInStock ?? '-'}</td>
                  <td>{listing.status}</td>
                  <td>{listing.syncStatus || '-'}</td>
                  <td>
                    <button className={styles.dangerButton} type="button" onClick={() => archiveListing(listing)}>
                      Archivar
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && listings.length === 0 && (
                <tr>
                  <td colSpan="9" className={styles.empty}>
                    Aun no hay publicaciones por canal. Crea una para preparar Mercado Libre, TikTok Shop o Amazon.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default ChannelsScreen;
