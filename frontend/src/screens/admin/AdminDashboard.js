import React, { useEffect, useState } from 'react';
import api from '../../services/apiService';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState({ summary: {}, topPages: [], sources: [], countries: [], referrers: [], daily: [] });
  const [quality, setQuality] = useState({}); const [days, setDays] = useState(30); const [error, setError] = useState('');
  useEffect(() => { Promise.all([api.get(`/analytics/dashboard?days=${days}`), api.get('/service-quality/dashboard')]).then(([views, service]) => { setAnalytics(views.data.data); setQuality(service.data.data.summary || {}); }).catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar las métricas.')); }, [days]);
  const maxDaily = Math.max(...(analytics.daily || []).map((entry) => entry.count), 1);
  return <div className={styles.dashboard}><header><div><span>Vista ejecutiva</span><h1>Dashboard de administración</h1><p>Tráfico, origen de visitantes y calidad de atención en una sola lectura.</p></div><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></header>{error && <div className={styles.error}>{error}</div>}
    <section className={styles.cards}><article><small>Vistas</small><strong>{analytics.summary.views || 0}</strong><span>{analytics.summary.viewsToday || 0} hoy</span></article><article><small>Visitantes aproximados</small><strong>{analytics.summary.visitors || 0}</strong><span>sin guardar IP</span></article><article><small>Páginas por visitante</small><strong>{analytics.summary.pagesPerVisitor || 0}</strong><span>promedio</span></article><article><small>SLA cumplido</small><strong>{quality.compliance == null ? '—' : `${quality.compliance}%`}</strong><span>{quality.breached || 0} vencidos</span></article><article><small>Calidad</small><strong>{quality.averageQuality == null ? '—' : `${quality.averageQuality}/5`}</strong><span>{quality.reviews || 0} revisiones</span></article></section>
    <section className={styles.chart}><div><h2>Vistas por día</h2><p>Las recargas repetidas en menos de 30 segundos se deduplican.</p></div><div className={styles.bars}>{analytics.daily?.length ? analytics.daily.map((entry) => <div key={entry.date}><span style={{height:`${Math.max(8,entry.count*100/maxDaily)}%`}} title={`${entry.date}: ${entry.count}`} /><small>{entry.date.slice(5)}</small></div>) : <p>Aún no hay vistas registradas.</p>}</div></section>
    <section className={styles.tables}><Metric title="Páginas más vistas" rows={analytics.topPages} /><Metric title="Origen del tráfico" rows={analytics.sources} /><Metric title="País" rows={analytics.countries} /><Metric title="Referentes" rows={analytics.referrers} /></section>
    <div className={styles.privacy}><i className="fas fa-user-shield" /><p>Analítica propia: no almacena direcciones IP, excluye panel administrativo y bots, respeta “Do Not Track” y usa un hash diario irreversible para estimar visitantes.</p></div>
  </div>;
};
const Metric = ({ title, rows = [] }) => <article><h2>{title}</h2>{rows.length ? rows.slice(0, 7).map((row) => <div key={row.label}><span>{row.label}</span><b>{row.count}</b></div>) : <p>Sin datos todavía.</p>}</article>;
export default AdminDashboard;
