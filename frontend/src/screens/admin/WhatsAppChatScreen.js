import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/apiService';
import styles from './WhatsAppChatScreen.module.css';

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const getDisplayName = (chat) => chat?.name || chat?.phone || chat?.jid || 'Cliente';

const WhatsAppChatScreen = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

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

  const loadMessages = async (chat) => {
    if (!chat?.jid) return;
    setError('');
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
    const timer = window.setInterval(() => {
      loadChats({ silent: true });
      if (selectedChat?.jid) loadMessages(selectedChat);
    }, 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.jid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!selectedChat?.jid || !cleanText) return;

    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/integrations/whatsapp/chats/${encodeURIComponent(selectedChat.jid)}/messages`, {
        text: cleanText,
      });
      setMessages(data.data.messages || []);
      setSelectedChat(data.data.chat || selectedChat);
      setText('');
      await loadChats({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>WhatsApp</h1>
          <p className={styles.subtitle}>Atencion a clientes desde el panel. Configuracion y QR viven en Configuracion.</p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={() => loadChats()}>
          <i className="fas fa-sync-alt"></i> Actualizar
        </button>
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
                onClick={() => loadMessages(chat)}
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
                <p className={styles.subtitle}>{selectedChat.phone ? `+${selectedChat.phone}` : selectedChat.jid}</p>
              </header>

              <div className={styles.messages}>
                {messages.map((message) => (
                  <article
                    className={`${styles.message} ${message.fromMe ? styles.outgoing : styles.incoming}`}
                    key={message.id}
                  >
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
                <textarea
                  className={styles.composerInput}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Escribe una respuesta..."
                />
                <button className={styles.primaryButton} type="submit" disabled={sending || !text.trim()}>
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
