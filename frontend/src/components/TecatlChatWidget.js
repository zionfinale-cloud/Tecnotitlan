import React, { useEffect, useRef, useState } from 'react';
import api from '../services/apiService';
import styles from './TecatlChatWidget.module.css';

const STORAGE_KEY = 'tecnotitlan_tecatl_conversation_id';

const quickMessages = [
  'Busco audifonos',
  'Quiero revisar mi pedido',
  'Quiero precio por mayoreo',
  'Tengo duda de garantia',
];

const TecatlChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ASSISTANT',
      content: 'Hola. Soy Tecatl, asesor de Tecnotitlan. Puedo ayudarte con productos, pedidos y soporte.',
    },
  ]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (messageText) => {
    const content = String(messageText || text).trim();
    if (!content || sending) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content,
    };
    setMessages((current) => [...current, userMessage]);
    setText('');
    setSending(true);
    setError('');

    try {
      const conversationId = localStorage.getItem(STORAGE_KEY);
      const { data } = await api.post('/chat/tecatl/message', {
        conversationId,
        message: content,
      });
      if (data.data?.conversationId) localStorage.setItem(STORAGE_KEY, data.data.conversationId);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'ASSISTANT',
          content: data.data?.reply || 'Te paso con un asesor para revisarlo bien.',
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.message || 'No pude responder ahora. Intenta de nuevo en unos segundos.');
    } finally {
      setSending(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    sendMessage(text);
  };

  return (
    <div className={styles.widget}>
      {open && (
        <section className={styles.panel} aria-label="Chat de Tecatl">
          <header className={styles.header}>
            <img className={styles.avatar} src="/images/tecatl-bot.png" alt="Tecatl" />
            <div>
              <strong>Tecatl</strong>
              <span>Asesor de Tecnotitlan</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <i className="fas fa-times"></i>
            </button>
          </header>

          <div className={styles.messages}>
            {messages.map((message) => (
              <article
                className={`${styles.message} ${message.role === 'USER' ? styles.userMessage : styles.assistantMessage}`}
                key={message.id}
              >
                {message.content}
              </article>
            ))}
            {sending && <article className={`${styles.message} ${styles.assistantMessage}`}>Tecatl esta escribiendo...</article>}
            <div ref={bottomRef} />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.quickActions}>
            {quickMessages.map((quickMessage) => (
              <button key={quickMessage} type="button" onClick={() => sendMessage(quickMessage)}>
                {quickMessage}
              </button>
            ))}
          </div>

          <form className={styles.form} onSubmit={submit}>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escribe tu duda..."
              aria-label="Mensaje para Tecatl"
            />
            <button type="submit" disabled={sending || !text.trim()} aria-label="Enviar mensaje">
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </section>
      )}

      <button className={styles.bubble} type="button" onClick={() => setOpen((current) => !current)}>
        <span className={styles.pulse}></span>
        <img className={styles.bubbleAvatar} src="/images/tecatl-bot.png" alt="" aria-hidden="true" />
        <span>Asistente</span>
      </button>
    </div>
  );
};

export default TecatlChatWidget;
