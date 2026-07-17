import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const statusLabels = {
  DISABLED: 'Desactivado',
  READY: 'Conectado',
  QR_RECEIVED: 'Escanea el QR',
  INITIALIZING: 'Inicializando',
  RECONNECTING: 'Reconectando',
  PAUSED: 'Pausado para proteger el numero',
  WAITING_FOR_SESSION_LOCK: 'Esperando sesion activa',
  DISCONNECTED: 'Desconectado',
  RESETTING: 'Reiniciando sesion',
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
      setMessage({ type: 'success', text: 'Conexion iniciada. Si ya existe sesion guardada, debe reconectar sin QR. Si no existe sesion, aparecera un QR para escanear una sola vez.' });
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

  const isDisabled = status?.provider === 'disabled';
  const isPaused = status?.status === 'PAUSED';
  const isWaitingLock = status?.status === 'WAITING_FOR_SESSION_LOCK';
  const isQrImage = typeof qr === 'string' && qr.startsWith('data:image/');

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>WhatsApp Tecnotitlan</h2>
          <p className={styles.subtitle}>
            {isDisabled
              ? 'WhatsApp esta desactivado para proteger el numero operativo. Reactivalo solo cuando tengas un canal estable.'
              : 'Vincula el numero operativo escaneando el QR. Esta seccion es solo para Super Admin. La sesion queda cifrada en la base de datos para evitar reescaneos.'}
          </p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={start} disabled={starting || isDisabled || isWaitingLock}>
          {starting ? 'Iniciando...' : 'Iniciar conexion'}
        </button>
        <button className={styles.secondaryButton} type="button" onClick={reset} disabled={resetting || starting || isDisabled}>
          {resetting ? 'Reiniciando...' : 'Borrar sesion y pedir QR'}
        </button>
      </div>

      {message && <div className={`${styles.notice} ${message.type === 'success' ? styles.success : styles.error}`}>{message.text}</div>}
      {isPaused && (
        <div className={`${styles.notice} ${styles.error}`}>
          WhatsApp esta pausado para proteger el numero. No borres la sesion ni pidas QR repetidamente; espera a que termine la restriccion o usa "Borrar sesion y pedir QR" solo si vas a vincular un numero sano.
        </div>
      )}
      {isWaitingLock && (
        <div className={`${styles.notice} ${styles.success}`}>
          Hay otra instancia protegiendo la sesion. Espera unos minutos o redeploya solo una vez; el sistema evitara abrir conexiones duplicadas.
        </div>
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Estado de conexion</h3>
          <div style={{ display: 'grid', gap: '.75rem' }}>
            <p><strong>Proveedor:</strong> {isDisabled ? 'Desactivado' : 'Baileys local'}</p>
            <p><strong>Estado:</strong> {statusLabels[status?.status] || status?.status || 'Sin estado'}</p>
            <p><strong>Conectado:</strong> {status?.connected ? 'Si' : 'No'}</p>
            {status?.lastError && <p><strong>Ultimo error:</strong> {status.lastError}</p>}
            {status?.user?.id && <p><strong>Cuenta:</strong> {status.user.id}</p>}
            {status?.authStorage && <p><strong>Almacenamiento:</strong> {status.authStorage === 'database' ? 'Base de datos cifrada' : status.authStorage}</p>}
            {status?.authDir && <p><strong>Sesion activa:</strong> <code>{status.authDir}</code></p>}
            <p className={styles.subtitle}>
              {isDisabled
                ? <>No se intentara conectar ni generar QR mientras <code>WHATSAPP_PROVIDER=disabled</code>. Las notificaciones seguiran saliendo por correo.</>
                : <>La sesion y las llaves de mensajes se guardan cifradas en PostgreSQL cuando <code>WHATSAPP_AUTH_STORAGE=database</code>. No cambies <code>SESSION_SECRET</code> sin cerrar primero la sesion.</>}
            </p>
          </div>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>QR de vinculacion</h3>
          {qr ? (
            <div style={{ display: 'grid', placeItems: 'center', gap: '1rem', padding: '1rem' }}>
              {isQrImage ? (
                <img src={qr} alt="QR WhatsApp" style={{ width: 260, height: 260, objectFit: 'contain' }} />
              ) : (
                <QRCodeSVG value={qr} size={260} includeMargin />
              )}
              <p className={styles.subtitle}>Abre WhatsApp en el telefono: Dispositivos vinculados -> Vincular dispositivo.</p>
            </div>
          ) : (
            <div className={`${styles.notice} ${status?.connected ? styles.success : styles.error}`}>
              {isDisabled
                ? 'WhatsApp esta desactivado. No se generara QR.'
                : status?.connected
                  ? 'WhatsApp ya esta conectado.'
                  : isPaused
                    ? 'WhatsApp esta pausado. No solicites QR nuevo hasta que el numero este listo.'
                    : isWaitingLock
                      ? 'Esperando que se libere la sesion activa.'
                      : 'Aun no hay QR. Presiona iniciar conexion y espera unos segundos.'}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WhatsappSettingsScreen;
