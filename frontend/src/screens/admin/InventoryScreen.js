import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const today = new Date().toISOString().slice(0, 10);

const CHANNELS = [
  { value: 'MERCADOLIBRE', label: 'Mercado Libre' },
  { value: 'TIKTOK_SHOP', label: 'TikTok Shop' },
  { value: 'AMAZON', label: 'Amazon' },
];

const getWeekStart = () => {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

const InventoryScreen = () => {
  const [products, setProducts] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [inventoryOverview, setInventoryOverview] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cut, setCut] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [entryForm, setEntryForm] = useState({
    productId: '',
    investmentId: '',
    quantity: '',
    unitCost: '',
    notes: '',
  });
  const [transferForm, setTransferForm] = useState({
    productId: '',
    channel: 'MERCADOLIBRE',
    quantity: '',
    price: '',
    stockBuffer: 0,
    notes: '',
  });
  const [dateRange, setDateRange] = useState({
    startDate: getWeekStart(),
    endDate: today,
  });

  const activeProducts = useMemo(
    () => products.filter((product) => !product.isArchived),
    [products]
  );

  const loadInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsResponse, investmentsResponse, overviewResponse, movementsResponse, cutResponse] = await Promise.all([
        api.get('/products', { params: { pageSize: 250 } }),
        api.get('/inventory/investments'),
        api.get('/inventory/overview'),
        api.get('/inventory/movements', { params: { limit: 25 } }),
        api.get('/inventory/cut', { params: dateRange }),
      ]);

      setProducts(productsResponse.data.data.products || []);
      setInvestments(investmentsResponse.data.data.investments || []);
      setInventoryOverview(overviewResponse.data.data.inventory || []);
      setMovements(movementsResponse.data.data.movements || []);
      setCut(cutResponse.data.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCut = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.get('/inventory/cut', { params: dateRange });
      setCut(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo calcular el corte.');
    }
  };

  const createStockEntry = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/inventory/entries', {
        ...entryForm,
        investmentId: entryForm.investmentId || undefined,
        quantity: Number(entryForm.quantity),
        unitCost: Number(entryForm.unitCost),
      });
      setSuccess('Entrada de inventario registrada.');
      setEntryForm({ productId: '', investmentId: '', quantity: '', unitCost: '', notes: '' });
      await loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la entrada.');
    }
  };

  const transferStock = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/inventory/transfers', {
        ...transferForm,
        quantity: Number(transferForm.quantity),
        price: transferForm.price === '' ? undefined : Number(transferForm.price),
        stockBuffer: Number(transferForm.stockBuffer || 0),
      });
      setSuccess('Stock movido al canal.');
      setTransferForm({
        productId: '',
        channel: 'MERCADOLIBRE',
        quantity: '',
        price: '',
        stockBuffer: 0,
        notes: '',
      });
      await loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo mover el stock al canal.');
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Inventario y salidas</h1>
          <p className={styles.subtitle}>
            Aqui ves piezas fisicas, stock por canal, entradas de mercancia y salidas por venta.
          </p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.formGrid}>
        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Entrada de mercancia</h2>
          <form onSubmit={createStockEntry}>
            <div className={styles.field}>
              <label className={styles.label}>Producto</label>
              <select
                className={styles.select}
                value={entryForm.productId}
                onChange={(event) => setEntryForm({ ...entryForm, productId: event.target.value })}
                required
              >
                <option value="">Selecciona producto</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Pagar desde inversion</label>
              <select
                className={styles.select}
                value={entryForm.investmentId}
                onChange={(event) => setEntryForm({ ...entryForm, investmentId: event.target.value })}
              >
                <option value="">Sin ligar a inversion</option>
                {investments.map((investment) => (
                  <option key={investment.id} value={investment.id}>
                    {investment.name} - disponible {currency.format(investment.remaining)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
              <div className={styles.field}>
                <label className={styles.label}>Cantidad</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={entryForm.quantity}
                  onChange={(event) => setEntryForm({ ...entryForm, quantity: event.target.value })}
                  placeholder="100"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Costo unitario</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryForm.unitCost}
                  onChange={(event) => setEntryForm({ ...entryForm, unitCost: event.target.value })}
                  placeholder="135"
                  required
                />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={entryForm.notes}
                onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })}
                placeholder="Factura, proveedor, guia, condiciones..."
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">Registrar entrada</button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Mover stock a canal</h2>
          <form onSubmit={transferStock}>
            <div className={styles.field}>
              <label className={styles.label}>Producto en bodega/web</label>
              <select
                className={styles.select}
                value={transferForm.productId}
                onChange={(event) => setTransferForm({ ...transferForm, productId: event.target.value })}
                required
              >
                <option value="">Selecciona producto</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name} ({product.countInStock} en bodega/web)
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Canal destino</label>
              <select
                className={styles.select}
                value={transferForm.channel}
                onChange={(event) => setTransferForm({ ...transferForm, channel: event.target.value })}
              >
                {CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>{channel.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
              <div className={styles.field}>
                <label className={styles.label}>Cantidad a mover</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(event) => setTransferForm({ ...transferForm, quantity: event.target.value })}
                  placeholder="10"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Precio canal</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferForm.price}
                  onChange={(event) => setTransferForm({ ...transferForm, price: event.target.value })}
                  placeholder="349"
                />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Buffer de seguridad</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={transferForm.stockBuffer}
                onChange={(event) => setTransferForm({ ...transferForm, stockBuffer: event.target.value })}
                placeholder="2"
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={transferForm.notes}
                onChange={(event) => setTransferForm({ ...transferForm, notes: event.target.value })}
                placeholder="Ej. Enviado a bodega Meli, apartado para TikTok, preparado para Amazon..."
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">Mover a canal</button>
            </div>
          </form>
        </section>
      </div>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>Inventario por producto y canal</h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>
              Existencia fisica y stock publicado por marketplace para evitar perder mercancia.
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Marca</th>
                <th>Stock fisico</th>
                <th>Web</th>
                <th>Mercado Libre</th>
                <th>TikTok Shop</th>
                <th>Amazon</th>
                <th>Costo prom.</th>
                <th>Recompra</th>
              </tr>
            </thead>
            <tbody>
              {inventoryOverview.map((item) => (
                <tr key={item.productId}>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{item.brand || '-'}</td>
                  <td>{item.totalPhysicalStock}</td>
                  <td>{item.channelStock?.WEB ?? 0}</td>
                  <td>{item.channelStock?.MERCADOLIBRE ?? 0}</td>
                  <td>{item.channelStock?.TIKTOK_SHOP ?? 0}</td>
                  <td>{item.channelStock?.AMAZON ?? 0}</td>
                  <td>{currency.format(item.costPrice || 0)}</td>
                  <td>{item.reorderSuggested ? 'Revisar' : 'OK'}</td>
                </tr>
              ))}
              {!loading && inventoryOverview.length === 0 && (
                <tr>
                  <td colSpan="10" className={styles.empty}>Aun no hay productos activos para inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>Corte de salidas / ventas</h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>Donde se vendio, cuanto salio, cuanto entro y cuanto quedo.</p>
          </div>
          <form className={styles.toolbar} onSubmit={refreshCut}>
            <input
              className={styles.input}
              type="date"
              value={dateRange.startDate}
              onChange={(event) => setDateRange({ ...dateRange, startDate: event.target.value })}
            />
            <input
              className={styles.input}
              type="date"
              value={dateRange.endDate}
              onChange={(event) => setDateRange({ ...dateRange, endDate: event.target.value })}
            />
            <button className={styles.secondaryButton} type="submit">Actualizar corte</button>
          </form>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.placeholderBox}>
            <strong>Ventas:</strong> {currency.format(cut?.salesRevenue || 0)}
          </div>
          <div className={styles.placeholderBox}>
            <strong>Utilidad bruta:</strong> {currency.format(cut?.grossProfit || 0)}
          </div>
          <div className={styles.placeholderBox}>
            <strong>Unidades vendidas:</strong> {cut?.unitsSold || 0}
          </div>
          <div className={styles.placeholderBox}>
            <strong>Compras del periodo:</strong> {currency.format(cut?.investedInPeriod || 0)}
          </div>
        </div>

        <div className={styles.tableWrap} style={{ marginTop: '1rem' }}>
          <h3 className={styles.title} style={{ fontSize: '1rem' }}>Ventas por canal</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Canal</th>
                <th>Unidades</th>
                <th>Ventas</th>
                <th>Costo</th>
                <th>Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {(cut?.salesByChannel || []).map((channel) => (
                <tr key={channel.channel}>
                  <td>{channel.channel}</td>
                  <td>{channel.unitsSold}</td>
                  <td>{currency.format(channel.revenue || 0)}</td>
                  <td>{currency.format(channel.cost || 0)}</td>
                  <td>{currency.format(channel.profit || 0)}</td>
                </tr>
              ))}
              {!loading && (cut?.salesByChannel || []).length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.empty}>Aun no hay ventas por canal en este periodo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.tableWrap} style={{ marginTop: '1rem' }}>
          <h3 className={styles.title} style={{ fontSize: '1rem' }}>Ventas por producto</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Vendidos</th>
                <th>Ventas</th>
                <th>Costo</th>
                <th>Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {(cut?.products || []).map((product) => (
                <tr key={product.productId}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td>{product.unitsSold}</td>
                  <td>{currency.format(product.revenue || 0)}</td>
                  <td>{currency.format(product.cost || 0)}</td>
                  <td>{currency.format(product.profit || 0)}</td>
                </tr>
              ))}
              {!loading && (cut?.products || []).length === 0 && (
                <tr>
                  <td colSpan="6" className={styles.empty}>No hay ventas registradas en este periodo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Historial de compras y salidas</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Canal</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Venta</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{new Date(movement.createdAt).toLocaleString('es-MX')}</td>
                  <td>{movement.type}</td>
                  <td>{movement.product?.sku} - {movement.product?.name}</td>
                  <td>{movement.channel || '-'}</td>
                  <td>{movement.quantity}</td>
                  <td>{currency.format(movement.totalCost || 0)}</td>
                  <td>{currency.format(movement.totalRevenue || 0)}</td>
                  <td>{movement.stockBefore} -> {movement.stockAfter}</td>
                </tr>
              ))}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan="8" className={styles.empty}>Aun no hay compras ni salidas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default InventoryScreen;
