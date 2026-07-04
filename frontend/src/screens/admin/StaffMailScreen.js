import React, { useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const MAIL_DOMAIN = 'tecnotitlan.com.mx';
const MAIL_SERVER = 'mail.tecnotitlan.com.mx';
const WEBMAIL_URL = 'https://webmail.tecnotitlan.com.mx';

const normalizeEmail = (value) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed : `${trimmed}@${MAIL_DOMAIN}`;
};

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const firstAddress = (addresses = []) => addresses[0]?.address || '';
const firstName = (addresses = []) => addresses[0]?.name || firstAddress(addresses);
const stripHtml = (value = '') => value.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const StaffMailScreen = () => {
  const [emailInput, setEmailInput] = useState('ventas@tecnotitlan.com.mx');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const email = useMemo(() => normalizeEmail(emailInput), [emailInput]);
  const isCorporateEmail = email.endsWith(`@${MAIL_DOMAIN}`);
  const credentials = { email, password };

  const settings = [
    { label: 'Usuario', value: email || 'usuario@tecnotitlan.com.mx' },
    { label: 'Servidor entrada', value: MAIL_SERVER },
    { label: 'IMAP SSL', value: '993' },
    { label: 'Servidor salida', value: MAIL_SERVER },
    { label: 'SMTP SSL', value: '465' },
  ];

  const canConnect = isCorporateEmail && password.length > 0;

  const loadInbox = async () => {
    if (!canConnect) {
      setError('Captura una cuenta corporativa y su contrasena para abrir la bandeja.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/staff-mail/messages', {
        ...credentials,
        limit: 25,
      });
      setMessages(data.data.messages || []);
      setSelectedMessage(null);
      setSuccess('Bandeja actualizada.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo conectar al correo.');
    } finally {
      setLoading(false);
    }
  };

  const readMessage = async (message) => {
    setReading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post(`/staff-mail/messages/${message.uid}`, credentials);
      setSelectedMessage(data.data.message);
      setReplyText('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo leer el correo.');
    } finally {
      setReading(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedMessage) return;
    setError('');
    setSuccess('');
    try {
      await api.post('/staff-mail/send', {
        ...credentials,
        to: firstAddress(selectedMessage.from),
        subject: selectedMessage.subject.startsWith('Re:')
          ? selectedMessage.subject
          : `Re: ${selectedMessage.subject}`,
        text: replyText,
        inReplyTo: selectedMessage.messageId,
      });
      setReplyText('');
      setSuccess('Respuesta enviada.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo enviar la respuesta.');
    }
  };

  const createTicket = async () => {
    if (!selectedMessage) return;
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/staff-mail/tickets', {
        ...credentials,
        uid: selectedMessage.uid,
        customerName: firstName(selectedMessage.from),
        customerEmail: firstAddress(selectedMessage.from),
        subject: selectedMessage.subject,
        message: selectedMessage.text || selectedMessage.html?.replace(/<[^>]+>/g, ' ') || 'Correo sin contenido.',
      });
      setSuccess(`Ticket creado: ${data.data.ticket.ticketNumber}`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear el ticket.');
    }
  };

  const copySettings = async () => {
    const text = settings.map((item) => `${item.label}: ${item.value}`).join('\n');
    await navigator.clipboard.writeText(text);
    setSuccess('Configuracion copiada.');
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Correo del equipo</h1>
          <p className={styles.subtitle}>
            Bandeja interna para leer, responder y convertir correos en tickets. No guardamos contrasenas.
          </p>
        </div>
        <a className={styles.secondaryButton} href={WEBMAIL_URL} target="_blank" rel="noreferrer">
          Abrir webmail
        </a>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.card}>
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
            <label className={styles.label}>Contrasena del correo</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="No se guarda en Tecnotitlan"
            />
            <small className={styles.muted}>Se usa solo para esta sesion contra IMAP/SMTP.</small>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={loadInbox} disabled={loading}>
            {loading ? 'Conectando...' : 'Abrir bandeja'}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={copySettings}>
            Copiar configuracion
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(320px, 1.4fr)', gap: '1rem', marginTop: '1.25rem' }}>
        <div className={styles.card}>
          <div className={styles.toolbar}>
            <div>
              <h2 className={styles.title} style={{ fontSize: '1.2rem', marginBottom: 0 }}>Bandeja</h2>
              <p className={styles.subtitle} style={{ marginBottom: 0 }}>{messages.length} correos cargados</p>
            </div>
          </div>

          {messages.length === 0 ? (
            <div className={styles.empty}>Conecta una cuenta para ver los ultimos correos.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {messages.map((message) => (
                <button
                  key={message.uid}
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => readMessage(message)}
                  style={{
                    display: 'block',
                    textAlign: 'left',
                    borderColor: selectedMessage?.uid === message.uid ? '#00d084' : '#cbd5e1',
                    whiteSpace: 'normal',
                  }}
                >
                  <strong>{message.subject}</strong>
                  <br />
                  <span>{firstName(message.from)}</span>
                  <br />
                  <small className={styles.muted}>{message.date ? dateFormat.format(new Date(message.date)) : ''}</small>
                  <p className={styles.muted} style={{ margin: '0.35rem 0 0' }}>{message.snippet}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.card}>
          {!selectedMessage ? (
            <div className={styles.empty}>{reading ? 'Abriendo correo...' : 'Selecciona un correo para leerlo.'}</div>
          ) : (
            <>
              <div className={styles.toolbar}>
                <div>
                  <h2 className={styles.title} style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>
                    {selectedMessage.subject}
                  </h2>
                  <p className={styles.subtitle} style={{ marginBottom: 0 }}>
                    De {firstName(selectedMessage.from)} &lt;{firstAddress(selectedMessage.from)}&gt;
                  </p>
                </div>
                <button className={styles.secondaryButton} type="button" onClick={createTicket}>
                  Crear ticket
                </button>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  minHeight: '220px',
                  background: '#f8fafc',
                  color: '#0f172a',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedMessage.text || stripHtml(selectedMessage.html) || 'Correo sin contenido.'}
              </div>

              {selectedMessage.attachments?.length > 0 && (
                <div className={styles.placeholderBox}>
                  <p className={styles.placeholderText}>
                    Este correo tiene {selectedMessage.attachments.length} adjunto(s). En esta primera version solo se muestran como referencia.
                  </p>
                </div>
              )}

              <form onSubmit={sendReply} style={{ marginTop: '1rem' }}>
                <label className={styles.field}>
                  <span className={styles.label}>Responder</span>
                  <textarea
                    className={styles.textarea}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Escribe la respuesta al cliente..."
                    required
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.button} type="submit">Enviar respuesta</button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>Configuracion tecnica</h2>
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
    </>
  );
};

export default StaffMailScreen;
