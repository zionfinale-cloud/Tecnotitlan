import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const today = new Date().toISOString().slice(0, 10);

const CASH_MOVEMENT_TYPES = [
  { value: 'CAPITAL_IN', label: 'Entrada extra de dinero' },
  { value: 'OPERATING_EXPENSE', label: 'Gasto operativo' },
  { value: 'UNEXPECTED_EXPENSE', label: 'Imprevisto' },
  { value: 'CASH_OUT', label: 'Salida de dinero' },
  { value: 'ADJUSTMENT_IN', label: 'Ajuste a favor' },
];

const typeLabels = CASH_MOVEMENT_TYPES.reduce((labels, type) => {
  labels[type.value] = type.label;
  return labels;
}, {});

const flattenCashMovements = (investments) => investments
  .flatMap((investment) => (investment.cashMovements || []).map((movement) => ({
    ...movement,
    investmentName: investment.name,
  })))
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const InvestmentsScreen = () => {
  const [investments, setInvestments] = useState([]);
  const [form, setForm] = useState({
    name: `Inversion ${today}`,
    amount: '',
    notes: '',
  });
  const [cashForm, setCashForm] = useState({
    investmentId: '',
    type: 'OPERATING_EXPENSE',
    amount: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const totals = useMemo(
    () => investments.reduce(
      (acc, investment) => ({
        amount: acc.amount + Number(investment.amount || 0),
        cashIn: acc.cashIn + Number(investment.cashIn || 0),
        inventorySpent: acc.inventorySpent + Number(investment.inventorySpent || 0),
        operatingExpenses: acc.operatingExpenses + Number(investment.operatingExpenses || 0),
        unexpectedExpenses: acc.unexpectedExpenses + Number(investment.unexpectedExpenses || 0),
        cashOut: acc.cashOut + Number(investment.cashOut || 0),
        spent: acc.spent + Number(investment.spent || 0),
        remaining: acc.remaining + Number(investment.remaining || 0),
      }),
      {
        amount: 0,
        cashIn: 0,
        inventorySpent: 0,
        operatingExpenses: 0,
        unexpectedExpenses: 0,
        cashOut: 0,
        spent: 0,
        remaining: 0,
      }
    ),
    [investments]
  );

  const cashMovements = useMemo(() => flattenCashMovements(investments), [investments]);

  const loadInvestments = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/inventory/investments');
      const nextInvestments = data.data.investments || [];
      setInvestments(nextInvestments);
      setCashForm((current) => ({
        ...current,
        investmentId: current.investmentId || nextInvestments[0]?.id || '',
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar las inversiones.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
    const interval = setInterval(() => {
      loadInvestments({ silent: true });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const createInvestment = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/inventory/investments', {
        ...form,
        amount: Number(form.amount),
      });
      setSuccess('Inversion registrada.');
      setForm({ name: `Inversion ${today}`, amount: '', notes: '' });
      await loadInvestments();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la inversion.');
    }
  };

  const createCashMovement = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post(`/inventory/investments/${cashForm.investmentId}/cash-movements`, {
        type: cashForm.type,
        amount: Number(cashForm.amount),
        notes: cashForm.notes,
      });
      setSuccess('Movimiento de dinero registrado.');
      setCashForm((current) => ({ ...current, amount: '', notes: '' }));
      await loadInvestments();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el movimiento de dinero.');
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Inversiones</h1>
          <p className={styles.subtitle}>
            Controla la bolsa de dinero: entradas, compras de mercancia, gastos operativos e imprevistos.
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
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Inversion inicial / Compra julio"
                required
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Monto inicial</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="30000"
                required
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Origen del dinero, objetivo, proveedor previsto..."
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">Guardar inversion</button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Movimiento de dinero</h2>
          <form onSubmit={createCashMovement}>
            <div className={styles.field}>
              <label className={styles.label}>Inversion</label>
              <select
                className={styles.select}
                value={cashForm.investmentId}
                onChange={(event) => setCashForm({ ...cashForm, investmentId: event.target.value })}
                required
              >
                <option value="">Selecciona inversion</option>
                {investments.map((investment) => (
                  <option key={investment.id} value={investment.id}>
                    {investment.name} - disponible {currency.format(investment.remaining || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Tipo</label>
              <select
                className={styles.select}
                value={cashForm.type}
                onChange={(event) => setCashForm({ ...cashForm, type: event.target.value })}
              >
                {CASH_MOVEMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Monto</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={cashForm.amount}
                onChange={(event) => setCashForm({ ...cashForm, amount: event.target.value })}
                placeholder="850"
                required
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={styles.textarea}
                value={cashForm.notes}
                onChange={(event) => setCashForm({ ...cashForm, notes: event.target.value })}
                placeholder="Gasolina, empaque, comision, imprevisto, deposito extra..."
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit" disabled={!investments.length}>
                Guardar movimiento
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Resumen de capital</h2>
        <div className={styles.formGrid}>
          <div className={styles.placeholderBox}><strong>Monto inicial:</strong> {currency.format(totals.amount)}</div>
          <div className={styles.placeholderBox}><strong>Entradas extra:</strong> {currency.format(totals.cashIn)}</div>
          <div className={styles.placeholderBox}><strong>Compras inventario:</strong> {currency.format(totals.inventorySpent)}</div>
          <div className={styles.placeholderBox}><strong>Gastos operativos:</strong> {currency.format(totals.operatingExpenses)}</div>
          <div className={styles.placeholderBox}><strong>Imprevistos:</strong> {currency.format(totals.unexpectedExpenses)}</div>
          <div className={styles.placeholderBox}><strong>Disponible real:</strong> {currency.format(totals.remaining)}</div>
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Inversiones activas</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Monto inicial</th>
                <th>Entradas extra</th>
                <th>Inventario</th>
                <th>Operativo</th>
                <th>Imprevistos</th>
                <th>Disponible</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((investment) => (
                <tr key={investment.id}>
                  <td>{investment.name}</td>
                  <td>{currency.format(investment.amount || 0)}</td>
                  <td>{currency.format(investment.cashIn || 0)}</td>
                  <td>{currency.format(investment.inventorySpent || 0)}</td>
                  <td>{currency.format(investment.operatingExpenses || 0)}</td>
                  <td>{currency.format(investment.unexpectedExpenses || 0)}</td>
                  <td>{currency.format(investment.remaining || 0)}</td>
                  <td>{new Date(investment.createdAt).toLocaleDateString('es-MX')}</td>
                </tr>
              ))}
              {!loading && investments.length === 0 && (
                <tr>
                  <td colSpan="8" className={styles.empty}>Registra tu primera inversion para empezar limpio.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Salidas y entradas de dinero</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Inversion</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {cashMovements.map((movement) => (
                <tr key={movement.id}>
                  <td>{new Date(movement.createdAt).toLocaleString('es-MX')}</td>
                  <td>{movement.investmentName}</td>
                  <td>{typeLabels[movement.type] || movement.type}</td>
                  <td>{currency.format(movement.amount || 0)}</td>
                  <td>{movement.notes || '-'}</td>
                </tr>
              ))}
              {!loading && cashMovements.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.empty}>Aun no hay movimientos de dinero.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default InvestmentsScreen;
