import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const statusLabels = {
  READY: 'Conectado',
  QR_RECEIVED: 'Escanea el QR',
  INITIALIZING: 'Inicializando',
  RECONNECTING: 'Reconectando',
  DISCONNECTED: 'Desconectado',
  ERROR: 'Error',
};

const WhatsappSettingsScreen = () => {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null);

  const loadStatus = async () => {
    try {
      const [statusResponse, qrResponse] = await Promise.all([
        api.get('/integrations/whatsapp/status'),
        api.get('/integrations/whatsapp/qr'),
      ]);
      setStatus(statusResponse.data.data);
      setQr(qrResponse.data.data.qr || '');
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo leer el estado de WhatsApp.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const timer = window.setInterval(loadStatus, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const start = async () => {
    setStarting(true);
    setMessage(null);
    try {
      const { data } = await api.post('/integrations/whatsapp/initialize');
      setStatus(data.data);
      setMessage({ type: 'success', text: 'Sesion iniciada. Si aparece QR, escanealo desde WhatsApp.' });
      await loadStatus();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo iniciar WhatsApp.' });
    } finally {
      setStarting(false);
    }
  };

  const reset = async () => {
    const confirmed = window.confirm('Esto cerrara la sesion actual de WhatsApp y borrara las credenciales guardadas para generar un QR nuevo. ¿Continuamos?');
    if (!confirmed) return;

    setResetting(true);
    setMessage(null);
    try {
      const { data } = await api.post('/integrations/whatsapp/reset');
      setStatus(data.data);
      setMessage({ type: 'success', text: 'Sesion reiniciada. Espera unos segundos para que aparezca el QR nuevo.' });
      await loadStatus();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo reiniciar la sesion de WhatsApp.' });
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div>Cargando WhatsApp...</div>;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>WhatsApp Tecnotitlan</h2>
          <p className={styles.subtitle}>Vincula el numero operativo escaneando el QR. Esta seccion es solo para Super Admin.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={start} disabled={starting}>
          {starting ? 'Iniciando...' : 'Iniciar / regenerar QR'}
        </button>
        <button className={styles.secondaryButton} type="button" onClick={reset} disabled={resetting || starting}>
          {resetting ? 'Reiniciando...' : 'Borrar sesion y pedir QR'}
        </button>
      </div>

      {message && <div className={`${styles.notice} ${message.type === 'success' ? styles.success : styles.error}`}>{message.text}</div>}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Estado de conexion</h3>
          <div style={{ display: 'grid', gap: '.75rem' }}>
            <p><strong>Estado:</strong> {statusLabels[status?.status] || status?.status || 'Sin estado'}</p>
            <p><strong>Conectado:</strong> {status?.connected ? 'Si' : 'No'}</p>
            {status?.lastError && <p><strong>Ultimo error:</strong> {status.lastError}</p>}
            {status?.user?.id && <p><strong>Cuenta:</strong> {status.user.id}</p>}
            <p className={styles.subtitle}>
              Para que no se pierda la sesion en redeploys, el VPS debe montar un volumen persistente en <code>/app/auth_info_baileys</code> o definir <code>WHATSAPP_AUTH_DIR</code>.
            </p>
          </div>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>QR de vinculacion</h3>
          {qr ? (
            <div style={{ display: 'grid', placeItems: 'center', gap: '1rem', padding: '1rem' }}>
              <QRCodeSVG value={qr} size={260} includeMargin />
              <p className={styles.subtitle}>Abre WhatsApp en el telefono: Dispositivos vinculados -> Vincular dispositivo.</p>
            </div>
          ) : (
            <div className={`${styles.notice} ${status?.connected ? styles.success : styles.error}`}>
              {status?.connected ? 'WhatsApp ya esta conectado.' : 'Aun no hay QR. Presiona iniciar y espera unos segundos.'}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WhatsappSettingsScreen;
