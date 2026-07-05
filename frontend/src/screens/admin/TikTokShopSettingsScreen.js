import React, { useEffect, useState } from 'react';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const formatDate = (date) => {
  if (!date) return 'Sin dato';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
};

const TikTokShopSettingsScreen = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);

  const loadStatus = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.get('/tiktok/status');
      setStatus(data.data);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar el estado de TikTok Shop.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const connect = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const { data } = await api.get('/tiktok/auth-url');
      window.location.href = data.data.authUrl;
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo iniciar la conexion con TikTok Shop.' });
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar TikTok Shop de Tecnotitlan?')) return;
    setWorking(true);
    setMessage(null);
    try {
      await api.delete('/tiktok/disconnect');
      setMessage({ type: 'success', text: 'TikTok Shop desconectado.' });
      await loadStatus();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo desconectar TikTok Shop.' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div>Cargando TikTok Shop...</div>;

  const integration = status?.integration;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>TikTok Shop</h2>
          <p className={styles.subtitle}>Conecta la tienda para sincronizar catalogo, inventario y pedidos en la siguiente fase.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={connect} disabled={working}>
          {working ? 'Abriendo...' : status?.isConnected ? 'Reconectar TikTok' : 'Conectar TikTok'}
        </button>
      </div>

      {message && <div className={`${styles.notice} ${message.type === 'success' ? styles.success : styles.error}`}>{message.text}</div>}

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Estado de conexion</h3>
        {status?.isConnected ? (
          <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
            <div>
              <strong>Estado</strong>
              <p className={styles.subtitle}>Conectado</p>
            </div>
            <div>
              <strong>Tienda / vendedor</strong>
              <p className={styles.subtitle}>{integration?.shopName || integration?.sellerName || 'TikTok Shop'}</p>
            </div>
            <div>
              <strong>Seller ID</strong>
              <p className={styles.subtitle}>{integration?.sellerId || 'Sin dato'}</p>
            </div>
            <div>
              <strong>Token vence</strong>
              <p className={styles.subtitle}>{formatDate(integration?.accessTokenExpiresAt)}</p>
            </div>
          </div>
        ) : (
          <p className={styles.subtitle} style={{ marginTop: '1rem' }}>
            Aun no esta conectado. Primero guarda App Key, App Secret y Redirect URI en Sistema.
          </p>
        )}
      </section>

      <section className={styles.card} style={{ marginTop: '1rem' }}>
        <h3 className={styles.cardTitle}>Redirect URL para TikTok</h3>
        <p className={styles.subtitle}>Pega exactamente esta URL en TikTok Shop Partner Center:</p>
        <code style={{ display: 'block', marginTop: '.75rem', padding: '1rem', background: '#f1f5f9', borderRadius: '12px' }}>
          https://api.tecnotitlan.com.mx/api/tiktok/callback
        </code>
      </section>

      {status?.isConnected && (
        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={disconnect} disabled={working}>
            Desconectar TikTok Shop
          </button>
        </div>
      )}
    </div>
  );
};

export default TikTokShopSettingsScreen;
