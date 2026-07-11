import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/apiService';
import { canViewCosts } from '../../utils/permissions';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const today = new Date().toISOString().slice(0, 10);

const MARKETPLACE_CHANNELS = [
  { value: 'MERCADOLIBRE', label: 'Mercado Libre' },
  { value: 'TIKTOK_SHOP', label: 'TikTok Shop' },
  { value: 'AMAZON', label: 'Amazon' },
];

const SALE_CHANNELS = [
  { value: 'WEB', label: 'Web / bodega' },
  ...MARKETPLACE_CHANNELS,
];

const MOVEMENT_TYPES = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'PURCHASE', label: 'Entradas de mercancia' },
  { value: 'SALE', label: 'Salidas por venta' },
  { value: 'CHANNEL_TRANSFER', label: 'Enviado a canal' },
  { value: 'ADJUSTMENT_IN', label: 'Ajuste entrada' },
  { value: 'ADJUSTMENT_OUT', label: 'Ajuste salida' },
  { value: 'RETURN_IN', label: 'Devolucion entrada' },
  { value: 'RETURN_OUT', label: 'Devolucion salida' },
];

const movementTypeLabels = MOVEMENT_TYPES.reduce((labels, type) => {
  if (type.value) labels[type.value] = type.label;
  return labels;
}, {});

const channelLabels = SALE_CHANNELS.reduce((labels, channel) => {
  labels[channel.value] = channel.label;
  return labels;
}, {});

const getWeekStart = () => {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

const InventoryScreen = () => {
  const { userInfo } = useContext(AuthContext);
  const showCosts = canViewCosts(userInfo);
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
  const [saleForm, setSaleForm] = useState({
    productId: '',
    channel: 'WEB',
    quantity: '',
    unitPrice: '',
    notes: '',
  });
  const [dateRange, setDateRange] = useState({
    startDate: getWeekStart(),
    endDate: today,
  });
  const [movementFilters, setMovementFilters] = useState({
    type: '',
    channel: '',
    productId: '',
    startDate: '',
    endDate: '',
  });

  const activeProducts = useMemo(
    () => products.filter((product) => !product.isArchived),
    [products]
  );

  const movementSummary = useMemo(() => movements.reduce(
    (acc, movement) => {
      const quantity = Number(movement.quantity || 0);
      const cost = Number(movement.totalCost || 0);
      const revenue = Number(movement.totalRevenue || 0);

      if (movement.type === 'PURCHASE' || movement.type === 'ADJUSTMENT_IN' || movement.type === 'RETURN_IN') {
        acc.entries.units += quantity;
        acc.entries.cost += cost;
      } else if (movement.type === 'SALE') {
        acc.sales.units += quantity;
        acc.sales.revenue += revenue;
        acc.sales.cost += cost;
      } else if (movement.type === 'CHANNEL_TRANSFER') {
        acc.transfers.units += quantity;
        acc.transfers.cost += cost;
      } else {
        acc.adjustments.units += quantity;
        acc.adjustments.cost += cost;
      }

      return acc;
    },
    {
      entries: { units: 0, cost: 0 },
      sales: { units: 0, revenue: 0, cost: 0 },
      transfers: { units: 0, cost: 0 },
      adjustments: { units: 0, cost: 0 },
    }
  ), [movements]);

  const setQuickMovementType = (type) => {
    setMovementFilters((current) => ({ ...current, type }));
  };

  const loadInventory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    const movementParams = Object.fromEntries(
      Object.entries({ limit: 50, ...movementFilters }).filter(([, value]) => value !== '')
    );
    try {
      const [productsResponse, overviewResponse, movementsResponse] = await Promise.all([
        api.get('/products', { params: { pageSize: 250 } }),
        api.get('/inventory/overview'),
        api.get('/inventory/movements', { params: movementParams }),
      ]);

      setProducts(productsResponse.data.data.products || []);
      setInventoryOverview(overviewResponse.data.data.inventory || []);
      setMovements(movementsResponse.data.data.movements || []);

      if (showCosts) {
        const [investmentsResponse, cutResponse] = await Promise.all([
          api.get('/inventory/investments'),
          api.get('/inventory/cut', { params: dateRange }),
        ]);
        setInvestments(investmentsResponse.data.data.investments || []);
        setCut(cutResponse.data.data || null);
      } else {
        setInvestments([]);
        setCut(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el inventario.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    showCosts,
    dateRange,
    movementFilters,
  ]);

  useEffect(() => {
    loadInventory();
    const interval = setInterval(() => {
      loadInventory({ silent: true });
    }, 15000);
    return () => clearInterval(interval);
  }, [loadInventory]);

  const refreshCut = async (event) => {
    event.preventDefault();
    if (!showCosts) return;
    setError('');
    try {
      const { data } = await api.get('/inventory/cut', { params: dateRange });
      setCut(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo calcular el corte.');
    }
  };

  const refreshMovements = async (event) => {
    event.preventDefault();
    await loadInventory();
  };

  const createStockEntry = async (event) => {
    event.preventDefault();
    if (!showCosts) return;
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

  const createManualSale = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/inventory/sales', {
        ...saleForm,
        quantity: Number(saleForm.quantity),
        unitPrice: Number(saleForm.unitPrice),
      });
      setSuccess('Venta/salida registrada.');
      setSaleForm({
        productId: '',
        channel: 'WEB',
        quantity: '',
        unitPrice: '',
        notes: '',
      });
      await loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la venta/salida.');
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
        {showCosts && (
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
        )}

        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Registrar venta / salida</h2>
          <form onSubmit={createManualSale}>
            <div className={styles.field}>
              <label className={styles.label}>Producto vendido</label>
              <select
                className={styles.select}
                value={saleForm.productId}
                onChange={(event) => setSaleForm({ ...saleForm, productId: event.target.value })}
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
              <label className={styles.label}>Donde se vendio</label>
              <select
                className={styles.select}
                value={saleForm.channel}
                onChange={(event) => setSaleForm({ ...saleForm, channel: event.target.value })}
              >
                {SALE_CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>{channel.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
              <div className={styles.field}>
                <label className={styles.label}>Cantidad vendida</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={saleForm.quantity}
                  onChange={(event) => setSaleForm({ ...saleForm, quantity: event.target.value })}
                  placeholder="1"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Precio unitario venta</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={saleForm.unitPrice}
                  onChange={(event) => setSaleForm({ ...saleForm, unitPrice: event.target.value })}
                  placeholder="299"
                  required
                />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={saleForm.notes}
                onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })}
                placeholder="Folio, cliente, marketplace, guia o referencia..."
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">Registrar venta</button>
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
                {MARKETPLACE_CHANNELS.map((channel) => (
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
                {showCosts && <th>Costo prom.</th>}
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
                  {showCosts && <td>{currency.format(item.costPrice || 0)}</td>}
                  <td>{item.reorderSuggested ? 'Revisar' : 'OK'}</td>
                </tr>
              ))}
              {!loading && inventoryOverview.length === 0 && (
                <tr>
                  <td colSpan={showCosts ? 10 : 9} className={styles.empty}>Aun no hay productos activos para inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCosts && (
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
      )}

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>Entradas, salidas y movimientos</h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>
              Filtra para auditar mercancia comprada, ventas, transferencias a marketplaces y ajustes.
            </p>
          </div>
        </div>

        <div className={styles.formGrid} style={{ marginBottom: '1rem' }}>
          <div className={styles.placeholderBox}>
            <strong>Entradas:</strong> {movementSummary.entries.units} pzas
            {showCosts && <> / {currency.format(movementSummary.entries.cost)}</>}
          </div>
          <div className={styles.placeholderBox}>
            <strong>Ventas:</strong> {movementSummary.sales.units} pzas
            {showCosts && <> / {currency.format(movementSummary.sales.revenue)}</>}
          </div>
          <div className={styles.placeholderBox}>
            <strong>Enviado a canales:</strong> {movementSummary.transfers.units} pzas
          </div>
          <div className={styles.placeholderBox}>
            <strong>Ajustes/devoluciones:</strong> {movementSummary.adjustments.units} pzas
          </div>
        </div>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: '1rem' }}>
          <button className={styles.secondaryButton} type="button" onClick={() => setQuickMovementType('')}>
            Ver todo
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => setQuickMovementType('PURCHASE')}>
            Solo entradas
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => setQuickMovementType('SALE')}>
            Solo ventas
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => setQuickMovementType('CHANNEL_TRANSFER')}>
            Solo enviados a canal
          </button>
        </div>

        <form className={styles.formGrid} onSubmit={refreshMovements} style={{ marginBottom: '1rem' }}>
          <div className={styles.field}>
            <label className={styles.label}>Tipo</label>
            <select
              className={styles.select}
              value={movementFilters.type}
              onChange={(event) => setMovementFilters({ ...movementFilters, type: event.target.value })}
            >
              {MOVEMENT_TYPES.map((type) => (
                <option key={type.label} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Canal</label>
            <select
              className={styles.select}
              value={movementFilters.channel}
              onChange={(event) => setMovementFilters({ ...movementFilters, channel: event.target.value })}
            >
              <option value="">Todos los canales</option>
              {SALE_CHANNELS.map((channel) => (
                <option key={channel.value} value={channel.value}>{channel.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Producto</label>
            <select
              className={styles.select}
              value={movementFilters.productId}
              onChange={(event) => setMovementFilters({ ...movementFilters, productId: event.target.value })}
            >
              <option value="">Todos los productos</option>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Desde</label>
            <input
              className={styles.input}
              type="date"
              value={movementFilters.startDate}
              onChange={(event) => setMovementFilters({ ...movementFilters, startDate: event.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Hasta</label>
            <input
              className={styles.input}
              type="date"
              value={movementFilters.endDate}
              onChange={(event) => setMovementFilters({ ...movementFilters, endDate: event.target.value })}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.secondaryButton} type="submit">Aplicar filtros</button>
          </div>
        </form>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Canal</th>
                <th>Cantidad</th>
                {showCosts && <th>Costo</th>}
                <th>Venta</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{new Date(movement.createdAt).toLocaleString('es-MX')}</td>
                  <td>{movementTypeLabels[movement.type] || movement.type}</td>
                  <td>{movement.product?.sku} - {movement.product?.name}</td>
                  <td>{channelLabels[movement.channel] || movement.channel || '-'}</td>
                  <td>{movement.quantity}</td>
                  {showCosts && <td>{currency.format(movement.totalCost || 0)}</td>}
                  <td>{currency.format(movement.totalRevenue || 0)}</td>
                  <td>{movement.stockBefore} -> {movement.stockAfter}</td>
                </tr>
              ))}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={showCosts ? 8 : 7} className={styles.empty}>Aun no hay compras ni salidas registradas.</td>
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
