import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/apiService';
import styles from './WhatsAppChatScreen.module.css';

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const getJidUser = (jid = '') => String(jid || '').split('@')[0] || '';
const isLidJid = (jid = '') => String(jid || '').endsWith('@lid');
const isUsablePhone = (chat) => {
  if (!chat?.phone) return false;
  if (isLidJid(chat.jid) && chat.phone === getJidUser(chat.jid)) return false;
  return /^\d{8,15}$/.test(String(chat.phone));
};

const getDisplayIdentifier = (chat) => {
  if (!chat) return '';
  if (isUsablePhone(chat)) return `+${chat.phone}`;
  if (isLidJid(chat.jid)) return `ID WhatsApp ${getJidUser(chat.jid).slice(-6)}`;
  return chat.jid || '';
};

const getDisplayName = (chat) => chat?.name || (isUsablePhone(chat) ? `+${chat.phone}` : getDisplayIdentifier(chat)) || 'Cliente';

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  return url;
};

const getFileLabel = (message) => message.fileName || message.text || 'Archivo adjunto';

const WhatsAppChatScreen = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const selectedChatRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const loadChats = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/integrations/whatsapp/chats');
      setChats(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los chats de WhatsApp.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadStatus = async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get('/integrations/whatsapp/status');
      setStatus(data.data || null);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || err.message || 'No se pudo leer el estado de WhatsApp.');
      }
    }
  };

  const isNearBottom = () => {
    const element = messagesRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 140;
  };

  const loadMessages = async (chat, { forceScroll = false } = {}) => {
    if (!chat?.jid) return;
    setError('');
    const isSameChat = selectedChatRef.current?.jid === chat.jid;
    shouldStickToBottomRef.current = forceScroll || !isSameChat || isNearBottom();
    try {
      const { data } = await api.get(`/integrations/whatsapp/chats/${encodeURIComponent(chat.jid)}/messages`);
      setSelectedChat(data.data.chat || chat);
      setMessages(data.data.messages || []);
      await loadChats({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la conversacion.');
    }
  };

  useEffect(() => {
    loadChats();
    loadStatus({ silent: true });
    const timer = window.setInterval(() => {
      loadChats({ silent: true });
      loadStatus({ silent: true });
      const currentChat = selectedChatRef.current;
      if (currentChat?.jid) {
        loadMessages(currentChat);
      }
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentCount = messages.length;
    const listWasReset = currentCount < previousMessageCountRef.current;
    if (shouldStickToBottomRef.current || listWasReset) {
      bottomRef.current?.scrollIntoView({ behavior: shouldStickToBottomRef.current ? 'smooth' : 'auto' });
    }
    previousMessageCountRef.current = currentCount;
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!selectedChat?.jid || (!cleanText && !file)) return;
    if (status && !status.connected) {
      setError('WhatsApp no esta conectado. Revisa Configuracion > WhatsApp QR antes de enviar.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const endpoint = `/integrations/whatsapp/chats/${encodeURIComponent(selectedChat.jid)}`;
      const { data } = file
        ? await api.post(`${endpoint}/media`, (() => {
          const formData = new FormData();
          formData.append('media', file);
          formData.append('caption', cleanText);
          return formData;
        })(), { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.post(`${endpoint}/messages`, { text: cleanText });
      shouldStickToBottomRef.current = true;
      setMessages(data.data.messages || []);
      setSelectedChat(data.data.chat || selectedChat);
      setText('');
      setFile(null);
      await loadChats({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const isConnected = Boolean(status?.connected);
  const statusLabel = status
    ? `${status.provider === 'evolution' ? 'Evolution' : 'Baileys'}: ${isConnected ? 'Conectado' : (status.status || 'Desconectado')}`
    : 'Revisando WhatsApp...';

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>WhatsApp</h1>
          <p className={styles.subtitle}>Atencion a clientes desde el panel. Configuracion y QR viven en Configuracion.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.statusPill} ${isConnected ? styles.statusReady : styles.statusOffline}`}>
            <i className={`fas ${isConnected ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {statusLabel}
          </span>
          <button className={styles.secondaryButton} type="button" onClick={() => { loadStatus(); loadChats(); }}>
            <i className="fas fa-sync-alt"></i> Actualizar
          </button>
        </div>
      </div>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}

      <div className={styles.workspace}>
        <aside className={styles.chatList}>
          <div className={styles.listHeader}>
            <strong>Conversaciones</strong>
            <span>{chats.length}</span>
          </div>
          <div className={styles.chatRows}>
            {loading ? (
              <div className={styles.empty}>Cargando chats...</div>
            ) : chats.length === 0 ? (
              <div className={styles.empty}>Aun no hay mensajes. Cuando un cliente escriba, aparecera aqui.</div>
            ) : chats.map((chat) => (
              <button
                className={`${styles.chatButton} ${selectedChat?.jid === chat.jid ? styles.chatButtonActive : ''}`}
                key={chat.jid}
                type="button"
                onClick={() => loadMessages(chat, { forceScroll: true })}
              >
                <div className={styles.chatTop}>
                  <span className={styles.chatName}>{getDisplayName(chat)}</span>
                  {chat.unreadCount > 0 && <span className={styles.badge}>{chat.unreadCount}</span>}
                </div>
                <p className={styles.chatPreview}>{chat.lastMessage || 'Sin mensajes visibles'}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.panel}>
          {selectedChat ? (
            <>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>{getDisplayName(selectedChat)}</h2>
                <p className={styles.subtitle}>{getDisplayIdentifier(selectedChat)}</p>
              </header>

              <div
                className={styles.messages}
                ref={messagesRef}
                onScroll={() => {
                  shouldStickToBottomRef.current = isNearBottom();
                }}
              >
                {messages.map((message) => (
                  <article
                    className={`${styles.message} ${message.fromMe ? styles.outgoing : styles.incoming}`}
                    key={message.id}
                  >
                    {message.mediaUrl && (
                      message.mediaType === 'image' || message.mediaMimeType?.startsWith('image/') ? (
                        <a href={resolveMediaUrl(message.mediaUrl)} target="_blank" rel="noreferrer">
                          <img
                            className={styles.mediaImage}
                            src={resolveMediaUrl(message.mediaUrl)}
                            alt={getFileLabel(message)}
                          />
                        </a>
                      ) : (
                        <a className={styles.mediaLink} href={resolveMediaUrl(message.mediaUrl)} target="_blank" rel="noreferrer">
                          <i className="fas fa-paperclip"></i>
                          {getFileLabel(message)}
                        </a>
                      )
                    )}
                    <p className={styles.messageText}>{message.text}</p>
                    <div className={styles.messageMeta}>
                      {message.sentBy && <span>{message.sentBy}</span>}
                      <span>{dateFormat.format(new Date(message.createdAt))}</span>
                    </div>
                  </article>
                ))}
                <div ref={bottomRef} />
              </div>

              <form className={styles.composer} onSubmit={send}>
                <div className={styles.composerBody}>
                  <textarea
                    className={styles.composerInput}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Escribe una respuesta..."
                  />
                  <div className={styles.composerTools}>
                    <label className={styles.fileButton}>
                      <i className="fas fa-paperclip"></i>
                      Adjuntar
                      <input
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    {file && (
                      <span className={styles.filePill}>
                        {file.name}
                        <button type="button" onClick={() => setFile(null)} aria-label="Quitar archivo">
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <button className={styles.primaryButton} type="submit" disabled={sending || (status && !status.connected) || (!text.trim() && !file)}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </>
          ) : (
            <div className={styles.empty}>
              <div>
                <h2>Selecciona una conversacion</h2>
                <p>Desde aqui ventas puede responder sin entrar a configuraciones ni ver datos sensibles.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WhatsAppChatScreen;
