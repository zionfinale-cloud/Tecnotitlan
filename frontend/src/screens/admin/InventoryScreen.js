import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const today = new Date().toISOString().slice(0, 10);

const getWeekStart = () => {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

const InventoryScreen = () => {
  const [products, setProducts] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cut, setCut] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [investmentForm, setInvestmentForm] = useState({
    name: `Inversion ${today}`,
    amount: '',
    notes: '',
  });
  const [entryForm, setEntryForm] = useState({
    productId: '',
    investmentId: '',
    quantity: '',
    unitCost: '',
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
      const [productsResponse, investmentsResponse, movementsResponse, cutResponse] = await Promise.all([
        api.get('/products', { params: { pageSize: 250 } }),
        api.get('/inventory/investments'),
        api.get('/inventory/movements', { params: { limit: 25 } }),
        api.get('/inventory/cut', { params: dateRange }),
      ]);

      setProducts(productsResponse.data.data.products || []);
      setInvestments(investmentsResponse.data.data.investments || []);
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

  const createInvestment = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/inventory/investments', {
        ...investmentForm,
        amount: Number(investmentForm.amount),
      });
      setSuccess('Inversion registrada.');
      setInvestmentForm({ name: `Inversion ${today}`, amount: '', notes: '' });
      await loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la inversion.');
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

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Inventario y cortes</h1>
          <p className={styles.subtitle}>
            Registra inversion, compras, salidas por venta y utilidad real por periodo.
          </p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.formGrid}>
        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Nueva inversion</h2>
          <form onSubmit={createInvestment}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input
                className={styles.input}
                value={investmentForm.name}
                onChange={(event) => setInvestmentForm({ ...investmentForm, name: event.target.value })}
                placeholder="Compra julio / Lote auriculares"
                required
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Monto invertido</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={investmentForm.amount}
                onChange={(event) => setInvestmentForm({ ...investmentForm, amount: event.target.value })}
                placeholder="30000"
                required
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={investmentForm.notes}
                onChange={(event) => setInvestmentForm({ ...investmentForm, notes: event.target.value })}
                placeholder="Proveedor, condiciones, objetivo del lote..."
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">Guardar inversion</button>
            </div>
          </form>
        </section>

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
              <label className={styles.label}>Inversion</label>
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

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>Corte</h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>Ventas, costo y utilidad del periodo.</p>
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
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Ultimos movimientos</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
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
                  <td>{movement.quantity}</td>
                  <td>{currency.format(movement.totalCost || 0)}</td>
                  <td>{currency.format(movement.totalRevenue || 0)}</td>
                  <td>{movement.stockBefore} -> {movement.stockAfter}</td>
                </tr>
              ))}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan="7" className={styles.empty}>Aun no hay movimientos de inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Inversiones</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Monto</th>
                <th>Gastado</th>
                <th>Disponible</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((investment) => (
                <tr key={investment.id}>
                  <td>{investment.name}</td>
                  <td>{currency.format(investment.amount || 0)}</td>
                  <td>{currency.format(investment.spent || 0)}</td>
                  <td>{currency.format(investment.remaining || 0)}</td>
                  <td>{new Date(investment.createdAt).toLocaleDateString('es-MX')}</td>
                </tr>
              ))}
              {!loading && investments.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.empty}>Registra tu primera inversion para empezar limpio.</td>
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
