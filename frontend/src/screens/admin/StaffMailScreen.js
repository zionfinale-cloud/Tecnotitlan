import React, { useMemo, useState } from 'react';
import styles from './ProductListScreen.module.css';

const MAIL_DOMAIN = 'tecnotitlan.com.mx';
const MAIL_SERVER = 'mail.tecnotitlan.com.mx';
const WEBMAIL_URL = 'https://webmail.tecnotitlan.com.mx';

const normalizeEmail = (value) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed : `${trimmed}@${MAIL_DOMAIN}`;
};

const StaffMailScreen = () => {
  const [emailInput, setEmailInput] = useState('ventas@tecnotitlan.com.mx');
  const email = useMemo(() => normalizeEmail(emailInput), [emailInput]);
  const isCorporateEmail = email.endsWith(`@${MAIL_DOMAIN}`);

  const settings = [
    { label: 'Usuario', value: email || 'usuario@tecnotitlan.com.mx' },
    { label: 'Servidor entrada', value: MAIL_SERVER },
    { label: 'IMAP SSL', value: '993' },
    { label: 'POP3 SSL', value: '995' },
    { label: 'Servidor salida', value: MAIL_SERVER },
    { label: 'SMTP SSL', value: '465' },
    { label: 'CalDAV/CardDAV SSL', value: `https://${MAIL_SERVER}:2080` },
    { label: 'Calendario', value: email ? `https://${MAIL_SERVER}:2080/calendars/${email}/calendar` : '-' },
    { label: 'Contactos', value: email ? `https://${MAIL_SERVER}:2080/addressbooks/${email}/addressbook` : '-' },
  ];

  const copySettings = async () => {
    const text = settings.map((item) => `${item.label}: ${item.value}`).join('\n');
    await navigator.clipboard.writeText(text);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Correo del equipo</h1>
          <p className={styles.subtitle}>
            Escribe tu cuenta corporativa para abrir webmail y ver la configuracion segura.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Correo corporativo</label>
            <input
              className={styles.input}
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="ventas o ventas@tecnotitlan.com.mx"
            />
            {!isCorporateEmail && (
              <small className={styles.muted}>Usa una cuenta terminada en @{MAIL_DOMAIN}.</small>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Acceso</label>
            <a
              className={styles.button}
              href={WEBMAIL_URL}
              target="_blank"
              rel="noreferrer"
              style={{ justifyContent: 'center' }}
            >
              <i className="fas fa-envelope-open-text"></i> Abrir webmail
            </a>
            <small className={styles.muted}>
              Inicia sesion con tu correo completo y la contrasena de esa cuenta.
            </small>
          </div>
        </div>
      </div>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>
              Configuracion manual
            </h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>
              Para configurar Outlook, Gmail, Apple Mail o el correo del telefono.
            </p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={copySettings}>
            Copiar configuracion
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              {settings.map((item) => (
                <tr key={item.label}>
                  <th>{item.label}</th>
                  <td>{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.placeholderBox}>
        <p className={styles.placeholderText}>
          Tecnotitlan no guarda contrasenas de correo. IMAP, POP3 y SMTP requieren autenticacion con la contrasena de cada cuenta.
        </p>
      </div>
    </>
  );
};

export default StaffMailScreen;
