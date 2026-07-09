import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const today = new Date().toISOString().slice(0, 10);

const InvestmentsScreen = () => {
  const [investments, setInvestments] = useState([]);
  const [form, setForm] = useState({
    name: `Inversion ${today}`,
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
        spent: acc.spent + Number(investment.spent || 0),
        remaining: acc.remaining + Number(investment.remaining || 0),
      }),
      { amount: 0, spent: 0, remaining: 0 }
    ),
    [investments]
  );

  const loadInvestments = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/inventory/investments');
      setInvestments(data.data.investments || []);
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

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Inversiones</h1>
          <p className={styles.subtitle}>
            Aqui controlas el dinero disponible. Las compras de inventario consumen esta bolsa.
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
              <label className={styles.label}>Monto</label>
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
          <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Resumen de capital</h2>
          <div className={styles.placeholderBox}><strong>Total invertido:</strong> {currency.format(totals.amount)}</div>
          <div className={styles.placeholderBox}><strong>Gastado en compras:</strong> {currency.format(totals.spent)}</div>
          <div className={styles.placeholderBox}><strong>Disponible:</strong> {currency.format(totals.remaining)}</div>
        </section>
      </div>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Historial de inversiones</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Monto</th>
                <th>Gastado</th>
                <th>Disponible</th>
                <th>Fecha</th>
                <th>Notas</th>
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
                  <td>{investment.notes || '-'}</td>
                </tr>
              ))}
              {!loading && investments.length === 0 && (
                <tr>
                  <td colSpan="6" className={styles.empty}>Registra tu primera inversion para empezar limpio.</td>
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
