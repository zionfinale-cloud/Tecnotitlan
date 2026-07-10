import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/apiService';
import { AuthContext } from '../../context/AuthContext';
import mailStyles from './StaffMailScreen.module.css';

const MAIL_DOMAIN = 'tecnotitlan.com.mx';
const WEBMAIL_URL = 'https://mail.tecnotitlan.com.mx:2096';

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

const playMailSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(980, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  } catch (error) {
    // El navegador puede bloquear audio hasta que haya interaccion del usuario.
  }
};

const baseFolderItems = [
  { id: 'INBOX', label: 'Recibidos', icon: 'fa-inbox' },
  { id: 'STARRED', label: 'Destacados', icon: 'fa-star', disabled: true },
  { id: 'SNOOZED', label: 'Pospuestos', icon: 'fa-clock', disabled: true },
  { id: 'SENT', label: 'Enviados', icon: 'fa-paper-plane' },
  { id: 'DRAFTS', label: 'Borradores', icon: 'fa-file' },
  { id: 'SPAM', label: 'Spam', icon: 'fa-shield-alt' },
  { id: 'TRASH', label: 'Papelera', icon: 'fa-trash' },
];

const folderLabels = baseFolderItems.reduce((labels, folder) => {
  labels[folder.id] = folder.label;
  return labels;
}, {});

const StaffMailScreen = () => {
  const { userInfo } = useContext(AuthContext);
  const suggestedEmail = userInfo?.email?.endsWith(`@${MAIL_DOMAIN}`) ? userInfo.email : '';
  const [emailInput, setEmailInput] = useState(suggestedEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: '', cc: '', bcc: '', subject: '', text: '' });
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const lastInboxCount = useRef(0);

  const email = useMemo(() => normalizeEmail(emailInput), [emailInput]);
  const isCorporateEmail = email.endsWith(`@${MAIL_DOMAIN}`);
  const credentials = { email, password };
  const canConnect = isCorporateEmail && password.length > 0;
  const unreadCount = messages.filter((message) => !message.seen).length;
  const folderItems = baseFolderItems.map((folder) => (
    folder.id === 'INBOX' ? { ...folder, count: unreadCount } : folder
  ));
  const contactStorageKey = email ? `tecnotitlan-mail-contacts:${email}` : '';

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((message) => [
      message.subject,
      message.snippet,
      firstName(message.from),
      firstAddress(message.from),
    ].join(' ').toLowerCase().includes(term));
  }, [messages, search]);

  const showSuccess = (message) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), 3500);
  };

  const maybeNotify = (newMessages) => {
    if (!newMessages.length) {
      lastInboxCount.current = 0;
      return;
    }
    const hasNewMail = lastInboxCount.current > 0 && newMessages.length > lastInboxCount.current;
    if (hasNewMail) {
      playMailSound();
    }
    if (notificationsEnabled && hasNewMail && Notification.permission === 'granted') {
      new Notification('Tecnotitlan Mail', {
        body: `Tienes ${newMessages.length - lastInboxCount.current} correo(s) nuevo(s).`,
      });
    }
    lastInboxCount.current = newMessages.length;
  };

  useEffect(() => {
    if (!contactStorageKey) {
      setContacts([]);
      return;
    }
    try {
      setContacts(JSON.parse(localStorage.getItem(contactStorageKey) || '[]'));
    } catch (err) {
      setContacts([]);
    }
  }, [contactStorageKey]);

  const saveContact = (address) => {
    const normalized = String(address || '').trim().toLowerCase();
    if (!normalized || !contactStorageKey) return;
    setContacts((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 25);
      localStorage.setItem(contactStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const loadMailbox = async ({ silent = false, mailbox = activeFolder } = {}) => {
    if (!canConnect) {
      setError('Captura tu cuenta corporativa y su contrasena para abrir la bandeja.');
      return;
    }
    if (!silent) {
      setLoading(true);
      setError('');
      setSuccess('');
    }
    try {
      const { data } = await api.post('/staff-mail/messages', {
        ...credentials,
        mailbox,
        limit: 35,
      });
      const nextMessages = data.data.messages || [];
      setMessages(nextMessages);
      setLastSyncedAt(new Date());
      setIsConnected(true);
      if (mailbox === 'INBOX') maybeNotify(nextMessages);
      if (!silent) showSuccess(mailbox === 'SENT' ? 'Enviados actualizados.' : 'Bandeja actualizada.');
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || 'No se pudo conectar al correo.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const connectMailbox = async (event) => {
    event.preventDefault();
    await loadMailbox({ mailbox: 'INBOX' });
  };

  const disconnectMailbox = () => {
    setIsConnected(false);
    setPassword('');
    setMessages([]);
    setSelectedMessage(null);
    setReplyText('');
    setSearch('');
    setComposeOpen(false);
    setLastSyncedAt(null);
    lastInboxCount.current = 0;
  };

  useEffect(() => {
    if (!canConnect || messages.length === 0) return undefined;
    const timer = window.setInterval(() => loadMailbox({ silent: true, mailbox: activeFolder }), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConnect, messages.length, notificationsEnabled, activeFolder]);

  const switchFolder = async (folder) => {
    if (folder.disabled) return;
    setActiveFolder(folder.id);
    setSelectedMessage(null);
    setMessages([]);
    await loadMailbox({ mailbox: folder.id });
  };

  const readMessage = async (message) => {
    setReading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post(`/staff-mail/messages/${message.uid}`, {
        ...credentials,
        mailbox: activeFolder,
      });
      setSelectedMessage(data.data.message);
      setReplyText('');
      setMessages((current) => current.map((item) => (
        item.uid === message.uid ? { ...item, seen: true } : item
      )));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo leer el correo.');
    } finally {
      setReading(false);
    }
  };

  const sendMail = async ({ to, cc, bcc, subject, text, inReplyTo }) => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/staff-mail/send', {
        ...credentials,
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        text,
        inReplyTo,
      });
      saveContact(to);
      showSuccess(data.data.sentCopyWarning ? 'Correo enviado, pero no se pudo guardar copia en Enviados.' : 'Correo enviado y guardado en Enviados.');
      if (activeFolder === 'SENT') {
        await loadMailbox({ mailbox: 'SENT', silent: true });
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo enviar el correo.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedMessage) return;
    const ok = await sendMail({
      to: firstAddress(selectedMessage.from),
      cc: replyCc,
      bcc: replyBcc,
      subject: selectedMessage.subject.startsWith('Re:')
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      text: replyText,
      inReplyTo: selectedMessage.messageId,
    });
    if (ok) {
      setReplyText('');
      setReplyCc('');
      setReplyBcc('');
    }
  };

  const sendCompose = async (event) => {
    event.preventDefault();
    const ok = await sendMail(composeForm);
    if (ok) {
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', text: '' });
      setComposeOpen(false);
    }
  };

  const deleteSelectedMessage = async () => {
    if (!selectedMessage) return;
    const confirmMsg = activeFolder === 'TRASH' 
      ? '¿Eliminar permanentemente este correo?' 
      : '¿Mover este correo a la papelera?';
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/staff-mail/messages/${selectedMessage.uid}/delete`, {
        ...credentials,
        mailbox: activeFolder,
      });
      showSuccess(activeFolder === 'TRASH' ? 'Correo eliminado permanentemente.' : 'Correo movido a la papelera.');
      setSelectedMessage(null);
      await loadMailbox({ mailbox: activeFolder });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el correo.');
    } finally {
      setSending(false);
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
        message: selectedMessage.text || stripHtml(selectedMessage.html) || 'Correo sin contenido.',
      });
      showSuccess(`Ticket creado: ${data.data.ticket.ticketNumber}`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear el ticket.');
    }
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setError('Este navegador no soporta notificaciones.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') showSuccess('Notificaciones activadas.');
  };

  const renderReader = () => {
    if (!selectedMessage) {
      return (
        <div className={mailStyles.emptyState}>
          <div>
            <div className={mailStyles.emptyIcon}><i className="fas fa-envelope-open-text"></i></div>
            <h2>{reading ? 'Abriendo correo...' : 'Selecciona un correo'}</h2>
            <p>Lee, responde y crea tickets sin salir del panel.</p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className={mailStyles.readerHeader}>
          <h2 className={mailStyles.readerTitle}>{selectedMessage.subject}</h2>
          <div className={mailStyles.readerMeta}>
            De {firstName(selectedMessage.from)} &lt;{firstAddress(selectedMessage.from)}&gt;
            {selectedMessage.date && <> · {dateFormat.format(new Date(selectedMessage.date))}</>}
          </div>
          <div className={mailStyles.readerActions}>
            <button className={mailStyles.softButton} type="button" onClick={createTicket}>
              <i className="fas fa-ticket-alt"></i> Crear ticket
            </button>
            <button className={mailStyles.dangerButton} type="button" onClick={deleteSelectedMessage} disabled={sending}>
              <i className="fas fa-trash-alt"></i> {activeFolder === 'TRASH' ? 'Eliminar permanente' : 'Borrar'}
            </button>
            <a className={mailStyles.softButton} href={`mailto:${firstAddress(selectedMessage.from)}`}>
              <i className="fas fa-external-link-alt"></i> Abrir externo
            </a>
          </div>
        </div>

        <div className={mailStyles.messageBody}>
          {selectedMessage.html ? (
            <iframe
              className={mailStyles.htmlFrame}
              title="Contenido del correo"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              srcDoc={selectedMessage.html}
            />
          ) : (
            selectedMessage.text || 'Correo sin contenido.'
          )}
        </div>

        {selectedMessage.attachments?.length > 0 && (
          <div className={`${mailStyles.notice} ${mailStyles.noticeSuccess}`}>
            Este correo tiene {selectedMessage.attachments.length} adjunto(s). Los mostraremos como descarga en la siguiente fase.
          </div>
        )}

        <form className={mailStyles.replyBox} onSubmit={sendReply}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              style={{ border: '1px solid #dbe5ef', borderRadius: '0.8rem', padding: '0.5rem', color: '#0f172a', fontSize: '0.85rem', outline: 0 }}
              value={replyCc}
              onChange={(event) => setReplyCc(event.target.value)}
              placeholder="Cc (con copia)"
            />
            <input
              style={{ border: '1px solid #dbe5ef', borderRadius: '0.8rem', padding: '0.5rem', color: '#0f172a', fontSize: '0.85rem', outline: 0 }}
              value={replyBcc}
              onChange={(event) => setReplyBcc(event.target.value)}
              placeholder="Bcc (copia oculta)"
            />
          </div>
          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Responder al cliente..."
            required
          />
          <div className={mailStyles.replyActions}>
            <button className={mailStyles.primaryButton} type="submit" disabled={sending}>
              <i className="fas fa-paper-plane"></i> {sending ? 'Enviando...' : 'Enviar respuesta'}
            </button>
          </div>
        </form>
      </>
    );
  };

  if (!isConnected) {
    return (
      <div className={mailStyles.loginShell}>
        <div className={mailStyles.loginCard}>
          <div className={mailStyles.loginBrand}>
            <div className={mailStyles.brandIcon}><i className="fas fa-microchip"></i></div>
            <div>
              <h1>Tecnotitlan Mail</h1>
              <p>Acceso privado para el equipo. Entra con tu correo corporativo.</p>
            </div>
          </div>

          {(error || success) && (
            <div className={`${mailStyles.notice} ${error ? mailStyles.noticeError : mailStyles.noticeSuccess}`} style={{ margin: '1rem 0 0' }}>
              {error || success}
            </div>
          )}

          <form className={mailStyles.loginForm} onSubmit={connectMailbox}>
            <label>
              Correo de la empresa
              <input
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="usuario@tecnotitlan.com.mx"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                required
              />
            </label>

            <label>
              Contrasena del correo
              <div className={mailStyles.passwordField}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="No se guarda en Tecnotitlan"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
                <button
                  type="button"
                  className={mailStyles.passwordToggle}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </label>

            {!isCorporateEmail && emailInput.trim() && (
              <small className={mailStyles.loginWarning}>Usa una cuenta terminada en @{MAIL_DOMAIN}.</small>
            )}

            <button className={mailStyles.primaryButton} type="submit" disabled={loading || !canConnect}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-lock-open'}`}></i>
              {loading ? 'Verificando...' : 'Entrar a mi bandeja'}
            </button>
          </form>

          <div className={mailStyles.loginMeta}>
            <span><i className="fas fa-shield-alt"></i> La contrasena no se almacena.</span>
            <span><i className="fas fa-envelope"></i> IMAP/SMTP seguro contra cPanel.</span>
            <a href={WEBMAIL_URL} target="_blank" rel="noreferrer">Abrir webmail como respaldo</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={mailStyles.mailShell}>
      <header className={mailStyles.topbar}>
        <div className={mailStyles.brand}>
          <div className={mailStyles.brandIcon}><i className="fas fa-microchip"></i></div>
          <div>
            <h1 className={mailStyles.brandTitle}>Tecnotitlan Mail</h1>
            <span className={mailStyles.brandSub}>{email || 'Conecta tu correo corporativo'}</span>
          </div>
        </div>

        <div className={mailStyles.searchBox}>
          <i className="fas fa-search"></i>
          <input
            className={mailStyles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en el correo"
          />
        </div>

        <div className={mailStyles.topActions}>
          <button className={mailStyles.iconButton} type="button" onClick={() => loadMailbox()} disabled={loading}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
          </button>
          <button className={mailStyles.iconButton} type="button" onClick={enableNotifications} title="Activar notificaciones">
            <i className={`fas ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`}></i>
          </button>
          <button className={mailStyles.softButton} type="button" onClick={disconnectMailbox}>
            Cambiar cuenta
          </button>
          <a className={mailStyles.softButton} href={WEBMAIL_URL} target="_blank" rel="noreferrer">
            Webmail
          </a>
        </div>
      </header>

      {(error || success) && (
        <div className={`${mailStyles.notice} ${error ? mailStyles.noticeError : mailStyles.noticeSuccess}`}>
          {error || success}
        </div>
      )}

      <main className={mailStyles.layout}>
        <aside className={mailStyles.sidebar}>
          <button className={`${mailStyles.primaryButton} ${mailStyles.composeButton}`} type="button" onClick={() => setComposeOpen(true)}>
            <i className="fas fa-pen"></i> Redactar
          </button>

          <nav className={mailStyles.folderList}>
            {folderItems.map((folder) => (
              <button
                key={folder.id}
                className={`${mailStyles.folderButton} ${activeFolder === folder.id ? mailStyles.folderButtonActive : ''}`}
                type="button"
                onClick={() => switchFolder(folder)}
                title={folder.disabled ? 'Disponible en la siguiente fase' : folder.label}
              >
                <span><i className={`fas ${folder.icon}`}></i> {folder.label}</span>
                {folder.count > 0 && <strong className={mailStyles.badge}>{folder.count}</strong>}
              </button>
            ))}
          </nav>

          <div className={mailStyles.accountCard}>
            <label>Cuenta activa</label>
            <strong>{email}</strong>
            <button className={mailStyles.softButton} type="button" onClick={disconnectMailbox}>
              Cerrar correo
            </button>
            <small className={mailStyles.privacyNote}>
              Sesion temporal. Para otra bandeja, cambia de cuenta.
            </small>
          </div>
        </aside>

        <section className={mailStyles.messageList}>
          <div className={mailStyles.listHeader}>
            <div>
            <strong>{folderLabels[activeFolder] || 'Principal'}</strong>
              <br />
              <small>{filteredMessages.length} mensajes</small>
            </div>
            <span className={mailStyles.statusPill}>
              <i className="fas fa-circle"></i>
              {lastSyncedAt ? `Actualizado ${lastSyncedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : 'Sin conectar'}
            </span>
          </div>

          {composeOpen && (
            <form className={mailStyles.composePanel} onSubmit={sendCompose}>
              <div className={mailStyles.composeHeader}>
                <strong>Nuevo mensaje</strong>
                <button className={mailStyles.iconButton} type="button" onClick={() => setComposeOpen(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className={mailStyles.composeBody}>
                <input
                  className={mailStyles.composeInput}
                  type="email"
                  value={composeForm.to}
                  onChange={(event) => setComposeForm((current) => ({ ...current, to: event.target.value }))}
                  placeholder="Para"
                  list="staff-mail-contacts"
                  required
                />
                <datalist id="staff-mail-contacts">
                  {contacts.map((contact) => <option key={contact} value={contact} />)}
                </datalist>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input
                    className={mailStyles.composeInput}
                    value={composeForm.cc}
                    onChange={(event) => setComposeForm((current) => ({ ...current, cc: event.target.value }))}
                    placeholder="Cc (con copia)"
                  />
                  <input
                    className={mailStyles.composeInput}
                    value={composeForm.bcc}
                    onChange={(event) => setComposeForm((current) => ({ ...current, bcc: event.target.value }))}
                    placeholder="Bcc (copia oculta)"
                  />
                </div>
                <input
                  className={mailStyles.composeInput}
                  value={composeForm.subject}
                  onChange={(event) => setComposeForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Asunto"
                  required
                />
                <textarea
                  className={mailStyles.composeTextarea}
                  value={composeForm.text}
                  onChange={(event) => setComposeForm((current) => ({ ...current, text: event.target.value }))}
                  placeholder="Escribe tu mensaje..."
                  required
                />
                <button className={mailStyles.primaryButton} type="submit" disabled={sending}>
                  <i className="fas fa-paper-plane"></i> {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          )}

          <div className={mailStyles.messageRows}>
            {filteredMessages.length === 0 ? (
              <div className={mailStyles.emptyState}>
                <div>
                  <div className={mailStyles.emptyIcon}><i className="fas fa-inbox"></i></div>
                  <h2>{messages.length ? 'Sin resultados' : 'Sin correos aqui'}</h2>
                  <p>{messages.length ? 'Prueba con otra busqueda.' : 'Esta carpeta no tiene mensajes cargados.'}</p>
                </div>
              </div>
            ) : filteredMessages.map((message) => (
              <button
                key={message.uid}
                type="button"
                className={[
                  mailStyles.messageRow,
                  selectedMessage?.uid === message.uid ? mailStyles.messageRowActive : '',
                  !message.seen ? mailStyles.messageRowUnread : '',
                ].filter(Boolean).join(' ')}
                onClick={() => readMessage(message)}
              >
                <div className={mailStyles.rowTop}>
                  <span className={mailStyles.sender}>{firstName(message.from)}</span>
                  <span className={mailStyles.date}>{message.date ? dateFormat.format(new Date(message.date)) : ''}</span>
                </div>
                <span className={mailStyles.subject}>{message.subject}</span>
                <p className={mailStyles.snippet}>{message.snippet || 'Sin vista previa'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className={mailStyles.reader}>
          {renderReader()}
        </section>
      </main>
    </div>
  );
};

export default StaffMailScreen;
