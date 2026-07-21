import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const statusLabels = {
  PENDING: 'Pendiente',
  SENT: 'Enviado',
  SKIPPED: 'Omitido',
  FAILED: 'Fallido',
};

const channelLabels = {
  EMAIL: 'Correo',
  WHATSAPP: 'WhatsApp',
  N8N: 'n8n',
  SYSTEM: 'Sistema',
};

const audienceLabels = {
  CUSTOMER: 'Cliente',
  STAFF: 'Equipo',
  ADMIN: 'Admin',
  SYSTEM: 'Sistema',
};

const statusClass = {
  SENT: styles.success,
  SKIPPED: styles.notice,
  FAILED: styles.error,
  PENDING: styles.notice,
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const NotificationLogsScreen = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [filters, setFilters] = useState({
    channel: '',
    status: '',
    orderNumber: '',
  });

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: '120' });
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.status) params.set('status', filters.status);
    if (filters.orderNumber.trim()) params.set('orderNumber', filters.orderNumber.trim());
    return params.toString();
  }, [filters]);

  const loadLogs = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.get(`/notification-logs?${query}`);
      setLogs(data.data || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'No se pudieron cargar los logs de notificaciones.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const updateFilter = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Logs de notificaciones</h2>
          <p className={styles.subtitle}>
            Bitacora de correos, WhatsApp y webhooks para rastrear por que se envio, fallo u omitio cada aviso.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={loadLogs} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {message && (
        <div className={`${styles.notice} ${message.type === 'error' ? styles.error : styles.success}`}>
          {message.text}
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Canal
            <select className={styles.select} name="channel" value={filters.channel} onChange={updateFilter}>
              <option value="">Todos</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Correo</option>
              <option value="N8N">n8n</option>
              <option value="SYSTEM">Sistema</option>
            </select>
          </label>
          <label className={styles.field}>
            Estado
            <select className={styles.select} name="status" value={filters.status} onChange={updateFilter}>
              <option value="">Todos</option>
              <option value="SENT">Enviados</option>
              <option value="FAILED">Fallidos</option>
              <option value="SKIPPED">Omitidos</option>
              <option value="PENDING">Pendientes</option>
            </select>
          </label>
          <label className={styles.field}>
            Folio
            <input
              className={styles.input}
              name="orderNumber"
              value={filters.orderNumber}
              onChange={updateFilter}
              placeholder="TECNO-000009"
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Ultimos eventos</h3>
        {loading ? (
          <p className={styles.subtitle}>Cargando bitacora...</p>
        ) : logs.length === 0 ? (
          <p className={styles.subtitle}>Aun no hay eventos con esos filtros.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Canal</th>
                  <th>Destino</th>
                  <th>Pedido</th>
                  <th>Estado</th>
                  <th>Evento</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>{channelLabels[log.channel] || log.channel}</td>
                    <td>
                      <strong>{audienceLabels[log.audience] || log.audience}</strong>
                      <br />
                      <span className={styles.subtitle}>{log.recipient || 'Sin destinatario'}</span>
                    </td>
                    <td>{log.orderNumber || '-'}</td>
                    <td>
                      <span className={`${styles.notice} ${statusClass[log.status] || ''}`} style={{ padding: '0.35rem 0.55rem' }}>
                        {statusLabels[log.status] || log.status}
                      </span>
                    </td>
                    <td>{log.event}</td>
                    <td>
                      {log.error ? (
                        <span className="text-danger fw-bold">{log.error}</span>
                      ) : (
                        <span className={styles.subtitle}>{log.message || '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default NotificationLogsScreen;
