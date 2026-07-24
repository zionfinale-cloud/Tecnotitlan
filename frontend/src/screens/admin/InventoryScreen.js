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

const ENTRY_MOVEMENT_TYPES = new Set(['PURCHASE', 'ADJUSTMENT_IN', 'RETURN_IN']);
const SALE_MOVEMENT_TYPES = new Set(['SALE']);
const TRANSFER_MOVEMENT_TYPES = new Set(['CHANNEL_TRANSFER']);
const ADJUSTMENT_MOVEMENT_TYPES = new Set(['ADJUSTMENT_OUT', 'RETURN_OUT']);

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
  const [activeInventoryTab, setActiveInventoryTab] = useState(showCosts ? 'entries' : 'sales');

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

  const inventoryTotals = useMemo(() => inventoryOverview.reduce(
    (acc, item) => {
      const warehouseStock = Number(item.channelStock?.WEB || 0);
      const marketplaceStock = MARKETPLACE_CHANNELS.reduce(
        (sum, channel) => sum + Number(item.channelStock?.[channel.value] || 0),
        0
      );
      const totalStock = Number(item.totalPhysicalStock || 0);
      const cost = Number(item.costPrice || 0);

      return {
        totalStock: acc.totalStock + totalStock,
        warehouseStock: acc.warehouseStock + warehouseStock,
        marketplaceStock: acc.marketplaceStock + marketplaceStock,
        inventoryValue: acc.inventoryValue + (totalStock * cost),
        reorderCount: acc.reorderCount + (item.reorderSuggested ? 1 : 0),
      };
    },
    {
      totalStock: 0,
      warehouseStock: 0,
      marketplaceStock: 0,
      inventoryValue: 0,
      reorderCount: 0,
    }
  ), [inventoryOverview]);

  const reorderAlerts = useMemo(() => inventoryOverview
    .filter((item) => item.reorderSuggested)
    .map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      currentStock: Number(item.totalPhysicalStock || 0),
      reorderPoint: Number(item.reorderPoint || 3),
      reorderQuantity: Number(item.reorderQuantity || Math.max(10 - Number(item.totalPhysicalStock || 0), 1)),
    }))
    .sort((a, b) => a.currentStock - b.currentStock || a.sku.localeCompare(b.sku)), [inventoryOverview]);

  const setQuickMovementType = (type) => {
    setMovementFilters((current) => ({ ...current, type }));
  };

  const movementGroups = useMemo(() => ({
    entries: movements.filter((movement) => ENTRY_MOVEMENT_TYPES.has(movement.type)),
    sales: movements.filter((movement) => SALE_MOVEMENT_TYPES.has(movement.type)),
    transfers: movements.filter((movement) => TRANSFER_MOVEMENT_TYPES.has(movement.type)),
    adjustments: movements.filter((movement) => ADJUSTMENT_MOVEMENT_TYPES.has(movement.type)),
  }), [movements]);

  const renderChannelStock = (item, channel) => {
    const assignedStock = Number(item.channelStock?.[channel] || 0);
    const publishedStock = item.channelPublishedStock?.[channel];
    const hasPublishedStock = publishedStock !== undefined && publishedStock !== null;
    const numericPublishedStock = Number(publishedStock || 0);
    const showPublishedNote = hasPublishedStock && numericPublishedStock !== assignedStock;
    const isOutOfSync = showPublishedNote && assignedStock === 0 && numericPublishedStock > 0;

    return (
      <span className={styles.stockCell}>
        <strong>{assignedStock}</strong>
        {showPublishedNote && (
          <small className={isOutOfSync ? styles.stockWarning : undefined}>
            {isOutOfSync ? 'Publicado desfasado' : 'Publicado'}: {publishedStock}
          </small>
        )}
      </span>
    );
  };

  const inventoryTabs = useMemo(() => [
    { value: 'overview', label: 'Resumen' },
    ...(showCosts ? [{ value: 'entries', label: 'Entradas' }] : []),
    { value: 'sales', label: 'Salidas' },
    { value: 'transfers', label: 'Traspasos' },
    { value: 'history', label: 'Historial' },
  ], [showCosts]);

  const renderMovementTable = (title, description, rows, emptyText) => (
    <div className={styles.tableWrap} style={{ marginTop: '1.25rem' }}>
      <div className={styles.toolbar} style={{ marginBottom: '0.5rem' }}>
        <div>
          <h3 className={styles.title} style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{title}</h3>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>{description}</p>
        </div>
      </div>
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
          {rows.map((movement) => (
            <tr key={movement.id}>
              <td>{new Date(movement.createdAt).toLocaleString('es-MX')}</td>
              <td>{movementTypeLabels[movement.type] || movement.type}</td>
              <td>{movement.product?.sku} - {movement.product?.name}</td>
              <td>{channelLabels[movement.channel] || movement.channel || '-'}</td>
              <td>{movement.quantity}</td>
              {showCosts && <td>{currency.format(movement.totalCost || 0)}</td>}
              <td>{currency.format(movement.totalRevenue || 0)}</td>
              <td>{movement.stockBefore} -&gt; {movement.stockAfter}</td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={showCosts ? 8 : 7} className={styles.empty}>{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

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
      const { data } = await api.post('/inventory/transfers', {
        ...transferForm,
        quantity: Number(transferForm.quantity),
        price: transferForm.price === '' ? undefined : Number(transferForm.price),
        stockBuffer: Number(transferForm.stockBuffer || 0),
      });
      const channelSync = data?.data?.channelSync;
      if (channelSync?.status === 'synced') {
        setSuccess(data.message || channelSync.message || 'Stock movido y sincronizado con el canal.');
      } else if (transferForm.channel === 'MERCADOLIBRE' && channelSync?.status === 'skipped') {
        setSuccess(`Stock movido a Mercado Libre, pero queda pendiente: ${channelSync.reason}`);
      } else if (transferForm.channel === 'MERCADOLIBRE' && channelSync?.status === 'error') {
        setSuccess(`Stock movido a Mercado Libre, pero no se pudo sincronizar: ${channelSync.reason}`);
      } else {
        setSuccess(data.message || 'Stock movido al canal.');
      }
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

      <div className={styles.tabBar} role="tablist" aria-label="Secciones de inventario">
        {inventoryTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`${styles.tabButton} ${activeInventoryTab === tab.value ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveInventoryTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className={styles.flowPanel}>
        <div className={styles.flowHeader}>
          <div>
            <span className={styles.kicker}>Flujo operativo</span>
            <h2>Del dinero a la venta, sin revolver piezas ni caja</h2>
            <p>
              Primero entra dinero en Inversiones, despues compras mercancia, luego la mandas a canales y finalmente registras salidas por venta.
            </p>
          </div>
          <div className={styles.flowMetricGrid}>
            <div className={styles.flowMetric}>
              <span>Stock total</span>
              <strong>{inventoryTotals.totalStock}</strong>
              <small>piezas fisicas</small>
            </div>
            <div className={styles.flowMetric}>
              <span>Bodega/Web</span>
              <strong>{inventoryTotals.warehouseStock}</strong>
              <small>listo para surtir</small>
            </div>
            <div className={styles.flowMetric}>
              <span>Canales</span>
              <strong>{inventoryTotals.marketplaceStock}</strong>
              <small>asignado a marketplaces</small>
            </div>
            <div className={styles.flowMetric}>
              <span>Recompra</span>
              <strong>{inventoryTotals.reorderCount}</strong>
              <small>{inventoryTotals.reorderCount ? 'productos bajo minimo' : 'sin alertas'}</small>
            </div>
            {showCosts && (
              <div className={styles.flowMetric}>
                <span>Valor inventario</span>
                <strong>{currency.format(inventoryTotals.inventoryValue)}</strong>
                <small>costo aproximado</small>
              </div>
            )}
          </div>
        </div>

        <div className={styles.flowSteps}>
          <a className={styles.flowStep} href="/admin/investments">
            <span>1</span>
            <strong>Inversion</strong>
            <small>Capital, gastos, imprevistos y recuperaciones de dinero.</small>
          </a>
          {showCosts && (
            <button className={styles.flowStep} type="button" onClick={() => setActiveInventoryTab('entries')}>
              <span>2</span>
              <strong>Entrada</strong>
              <small>Compra real de producto. La mercancia entra a bodega/web.</small>
            </button>
          )}
          <button className={styles.flowStep} type="button" onClick={() => setActiveInventoryTab('transfers')}>
            <span>3</span>
            <strong>Traspaso</strong>
            <small>Mueve piezas de bodega/web a Meli, TikTok Shop o Amazon.</small>
          </button>
          <button className={styles.flowStep} type="button" onClick={() => setActiveInventoryTab('sales')}>
            <span>4</span>
            <strong>Salida</strong>
            <small>Venta por canal. Aqui se descuenta el stock asignado.</small>
          </button>
          <button className={styles.flowStep} type="button" onClick={() => setActiveInventoryTab('overview')}>
            <span>5</span>
            <strong>Corte</strong>
            <small>Ventas, utilidad y productos que necesitan recompra.</small>
          </button>
        </div>

        {reorderAlerts.length > 0 && (
          <div className={styles.reorderPanel}>
            <div>
              <strong>Productos pendientes de recompra</strong>
              <span>Prioridad por menor stock fisico total.</span>
            </div>
            <div className={styles.reorderList}>
              {reorderAlerts.slice(0, 5).map((item) => (
                <span key={item.productId} className={styles.reorderChip}>
                  {item.sku} - {item.name}: stock {item.currentStock}, comprar {item.reorderQuantity}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {activeInventoryTab === 'entries' && showCosts && (
      <>
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
        </div>
        {renderMovementTable(
          'Entradas de mercancia',
          'Compras, devoluciones recibidas o ajustes que aumentan existencia fisica.',
          movementGroups.entries,
          'No hay entradas con estos filtros.'
        )}
      </>
      )}

      {activeInventoryTab === 'sales' && (
      <>
        <div className={styles.formGrid}>
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
        </div>
        {renderMovementTable(
          'Salidas por venta',
          'Productos vendidos en web, Mercado Libre, TikTok Shop, Amazon u otro canal.',
          movementGroups.sales,
          'No hay ventas/salidas con estos filtros.'
        )}
      </>
      )}

      {activeInventoryTab === 'transfers' && (
      <>
        <div className={styles.formGrid}>
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
              <small className={styles.muted}>
                En Mercado Libre se publica el stock asignado menos este buffer. Si el producto no esta vinculado a una publicacion, el traspaso queda como pendiente.
              </small>
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
        {renderMovementTable(
          'Traspasos a canales',
          'Mercancia apartada o enviada para venderse en Mercado Libre, TikTok Shop o Amazon.',
          movementGroups.transfers,
          'No hay traspasos a canales con estos filtros.'
        )}
      </>
      )}

      {activeInventoryTab === 'overview' && (
      <>
      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>Inventario por producto y canal</h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>
              Stock real por ubicacion. "Publicado desfasado" significa que la publicacion del marketplace aun muestra piezas que no estan asignadas fisicamente.
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
                <th>Stock total</th>
                <th>Bodega/Web</th>
                <th>ML asignado</th>
                <th>TikTok asignado</th>
                <th>Amazon asignado</th>
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
                  <td>{renderChannelStock(item, 'MERCADOLIBRE')}</td>
                  <td>{renderChannelStock(item, 'TIKTOK_SHOP')}</td>
                  <td>{renderChannelStock(item, 'AMAZON')}</td>
                  {showCosts && <td>{currency.format(item.costPrice || 0)}</td>}
                  <td>
                    {item.reorderSuggested ? (
                      <span className={styles.reorderBadge}>
                        Comprar {item.reorderQuantity || Math.max(10 - Number(item.totalPhysicalStock || 0), 1)}
                      </span>
                    ) : (
                      <span className={styles.okBadge}>OK</span>
                    )}
                  </td>
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
      </>
      )}

      {activeInventoryTab === 'history' && (
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

        {renderMovementTable(
          'Entradas de mercancia',
          'Compras, devoluciones recibidas o ajustes que aumentan existencia fisica.',
          movementGroups.entries,
          'No hay entradas con estos filtros.'
        )}

        {renderMovementTable(
          'Salidas por venta',
          'Productos vendidos en web, Mercado Libre, TikTok Shop, Amazon u otro canal.',
          movementGroups.sales,
          'No hay ventas/salidas con estos filtros.'
        )}

        {renderMovementTable(
          'Traspasos a canales',
          'Mercancia apartada o enviada para venderse en Mercado Libre, TikTok Shop o Amazon.',
          movementGroups.transfers,
          'No hay traspasos a canales con estos filtros.'
        )}

        {renderMovementTable(
          'Ajustes y devoluciones',
          'Correcciones manuales, devoluciones salientes o movimientos especiales.',
          movementGroups.adjustments,
          'No hay ajustes o devoluciones con estos filtros.'
        )}
      </section>
      )}
    </>
  );
};

export default InventoryScreen;
