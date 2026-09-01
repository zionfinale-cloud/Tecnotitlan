import React, { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/apiService';
import styles from './SecurityScreen.module.css';

const formatDate = (value) => value ? new Date(value).toLocaleString('es-MX') : '-';

const SecurityScreen = ({ admin = false }) => {
  const { userInfo, updateProfile } = useContext(AuthContext);
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [audit, setAudit] = useState([]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const requests = [api.get('/security/status'), api.get('/security/activity')];
    if (admin) requests.push(api.get('/audit-logs?days=30&limit=100'));
    const responses = await Promise.all(requests);
    setStatus(responses[0].data.data);
    setActivity(responses[1].data.data.logs || []);
    if (admin) setAudit(responses[2].data.data.logs || []);
  }, [admin]);

  useEffect(() => { load().catch((err) => setError(err.response?.data?.message || 'No se pudo cargar seguridad.')); }, [load]);

  const run = async (operation, success) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await operation();
      const data = response.data.data || {};
      if (typeof data.twoFactorEnabled === 'boolean') updateProfile({ twoFactorEnabled: data.twoFactorEnabled });
      if (data.recoveryCodes) setRecoveryCodes(data.recoveryCodes);
      setMessage(success);
      setPassword(''); setCode('');
      await load();
      return data;
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo completar la operacion.');
      return null;
    } finally { setBusy(false); }
  };

  const beginSetup = async () => {
    const data = await run(() => api.post('/security/2fa/setup', { password }), 'Escanea el QR y confirma un codigo.');
    if (data) setSetup(data);
  };
  const enable = async () => {
    const data = await run(() => api.post('/security/2fa/enable', { setupToken: setup.setupToken, code }), '2FA quedo activado. Guarda los codigos de recuperacion.');
    if (data) setSetup(null);
  };
  const disable = () => run(() => api.post('/security/2fa/disable', { password, code }), '2FA quedo desactivado.');
  const regenerate = () => run(() => api.post('/security/2fa/recovery-codes', { code }), 'Se reemplazaron los codigos anteriores.');
  const copyCodes = () => navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => setMessage('Codigos copiados.'));

  if (!status) return <div className={styles.page}>Cargando seguridad...</div>;
  return <div className={styles.page}>
    <header><span>Proteccion de cuenta</span><h1>Cifrado, auditoria y 2FA</h1><p>Los tokens de integraciones se cifran en reposo y cada cambio sensible deja trazabilidad sin guardar credenciales.</p></header>
    {message && <div className={styles.success}>{message}</div>}{error && <div className={styles.error}>{error}</div>}
    <section className={styles.grid}>
      <article className={styles.card}>
        <div className={styles.cardTitle}><div><h2>Autenticacion de dos factores</h2><p>Estado: <b>{status.twoFactorEnabled ? 'Activa' : 'Inactiva'}</b></p></div><i className={`fas ${status.twoFactorEnabled ? 'fa-shield-alt' : 'fa-shield'}`} /></div>
        {!status.twoFactorEnabled && !setup && <><label>Confirma tu contrasena<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label><button disabled={busy || !password} onClick={beginSetup}>Configurar 2FA</button></>}
        {setup && <div className={styles.setup}><img src={setup.qrCodeDataUrl} alt="Codigo QR para configurar 2FA" /><p>Escanea con Google Authenticator, Microsoft Authenticator, 1Password o una aplicacion compatible.</p><details><summary>No puedo escanearlo</summary><code>{setup.secret}</code></details><label>Codigo de 6 digitos<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" /></label><button disabled={busy || !code} onClick={enable}>Confirmar y activar</button></div>}
        {status.twoFactorEnabled && <><p>Codigos de recuperacion disponibles: <b>{status.recoveryCodesRemaining}</b></p><label>Codigo 2FA o de recuperacion<input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label><div className={styles.actions}><button disabled={busy || !code} onClick={regenerate}>Nuevos codigos</button>{userInfo?.role === 'USER' && <button className={styles.danger} disabled={busy || !code || !password} onClick={disable}>Desactivar</button>}</div>{userInfo?.role === 'USER' ? <label>Contrasena actual para desactivar<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label> : <p>El segundo factor es obligatorio para cuentas de personal.</p>}</>}
      </article>
      <article className={styles.card}><h2>Controles activos</h2><ul><li>AES-256-GCM para tokens de Mercado Libre y TikTok.</li><li>Códigos TOTP de 30 segundos con tolerancia de reloj limitada.</li><li>Sesiones invalidadas después de cambios de contraseña o 2FA.</li><li>IP convertida a huella irreversible; contraseñas y cuerpos nunca se auditan.</li></ul></article>
    </section>
    {recoveryCodes.length > 0 && <section className={`${styles.card} ${styles.recovery}`}><h2>Guarda estos códigos ahora</h2><p>Cada código funciona una sola vez. No volverán a mostrarse.</p><div>{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div><button onClick={copyCodes}>Copiar códigos</button></section>}
    <section className={styles.card}><h2>Actividad de seguridad reciente</h2><div className={styles.table}><div className={styles.row}><b>Accion</b><b>Resultado</b><b>Fecha</b></div>{activity.map((item) => <div className={styles.row} key={item.id}><span>{item.action}</span><span>{item.outcome}</span><span>{formatDate(item.createdAt)}</span></div>)}</div></section>
    {admin && <section className={styles.card}><h2>Auditoria administrativa · últimos 30 días</h2><p>Últimos 100 cambios sensibles y operativos.</p><div className={styles.table}><div className={`${styles.row} ${styles.auditRow}`}><b>Actor</b><b>Accion</b><b>Categoria</b><b>Resultado</b><b>Fecha</b></div>{audit.map((item) => <div className={`${styles.row} ${styles.auditRow}`} key={item.id}><span>{item.actorEmail || 'Sistema'}</span><span>{item.action}</span><span>{item.category}</span><span>{item.outcome}</span><span>{formatDate(item.createdAt)}</span></div>)}</div></section>}
  </div>;
};

export default SecurityScreen;
