import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './MercadoLibreCommunicationsScreen.module.css';

const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const statusLabels = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En atención', WAITING_CUSTOMER: 'Esperando cliente', RESOLVED: 'Resuelto',
};
const fmtDate = (value) => value ? dateTime.format(new Date(value)) : 'Sin fecha';
const itemKey = (type, id) => `${type}:${id}`;

const MercadoLibreCommunicationsScreen = () => {
  const [questions, setQuestions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [draft, setDraft] = useState('');

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/mercadolibre/communications');
      const nextQuestions = data.data.questions || [];
      const nextConversations = data.data.conversations || [];
      setQuestions(nextQuestions);
      setConversations(nextConversations);
      setActivities(data.data.activities || []);
      setSelectedKey((current) => current
        || (nextQuestions[0] ? itemKey('question', nextQuestions[0].externalQuestionId) : '')
        || (nextConversations[0] ? itemKey('post-sale', nextConversations[0].packId) : ''));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar la bandeja de Mercado Libre.');
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      await load();
      try {
        await api.post('/mercadolibre/communications/sync');
        if (active) await load({ silent: true });
      } catch (syncError) {
        // La bandeja local sigue disponible si Mercado Libre esta temporalmente fuera de linea.
      }
    };
    bootstrap();
    return () => { active = false; };
  }, []);

  const items = useMemo(() => [
    ...questions.map((question) => ({
      type: 'question', id: question.externalQuestionId, date: question.askedAt || question.updatedAt,
      pending: question.status === 'UNANSWERED', data: question,
    })),
    ...conversations.map((conversation) => ({
      type: 'post-sale', id: conversation.packId, date: conversation.lastMessageAt || conversation.updatedAt,
      pending: conversation.unreadCount > 0, data: conversation,
    })),
  ].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)), [questions, conversations]);

  const visibleItems = items.filter((item) => filter === 'all' || filter === item.type || (filter === 'pending' && item.pending));
  const selected = visibleItems.find((item) => itemKey(item.type, item.id) === selectedKey) || visibleItems[0] || items[0];
  const selectedActivities = activities.filter((activity) => activity.externalId === selected?.id);
  const unanswered = questions.filter((question) => question.status === 'UNANSWERED').length;
  const unread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  const run = async (request, message) => {
    setBusy(true); setError(''); setSuccess('');
    try {
      await request();
      await load({ silent: true });
      setSuccess(message);
    } catch (err) {
      setError(err.response?.data?.message || 'Mercado Libre rechazó la operación.');
    } finally { setBusy(false); }
  };

  const sync = () => run(() => api.post('/mercadolibre/communications/sync'), 'Preguntas y mensajes sincronizados.');
  const submitReply = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;
    const request = selected.type === 'question'
      ? () => api.post(`/mercadolibre/questions/${selected.id}/answer`, { text })
      : () => api.post(`/mercadolibre/post-sale/${selected.id}/messages`, { text });
    await run(request, selected.type === 'question' ? 'Respuesta publicada.' : 'Mensaje posventa enviado.');
    setDraft('');
  };
  const update = (payload) => run(
    () => api.put(`/mercadolibre/communications/${selected.type}/${selected.id}`, payload),
    'Seguimiento interno actualizado.',
  );
  const markRead = () => run(
    () => api.post(`/mercadolibre/post-sale/${selected.id}/read`),
    'Conversación marcada como leída.',
  );

  if (loading) return <div className={styles.empty}>Cargando atención Mercado Libre...</div>;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span>Atención Mercado Libre</span><h1>Preguntas y mensajes</h1><p>Una sola bandeja para convertir dudas en ventas y atender cada compra con contexto.</p></div>
        <button onClick={sync} disabled={busy}><i className="fas fa-sync-alt" /> Sincronizar</button>
      </header>
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      <section className={styles.stats}>
        <article><small>Preguntas sin responder</small><strong>{unanswered}</strong></article>
        <article><small>Mensajes sin leer</small><strong>{unread}</strong></article>
        <article><small>Conversaciones posventa</small><strong>{conversations.length}</strong></article>
        <article><small>Total en bandeja</small><strong>{items.length}</strong></article>
      </section>
      <nav className={styles.filters}>
        {[['all','Todo'],['pending','Pendientes'],['question','Preventa'],['post-sale','Posventa']].map(([value, label]) => (
          <button key={value} className={filter === value ? styles.filterActive : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </nav>
      {items.length === 0 ? <div className={styles.empty}><i className="fas fa-inbox" /><h2>La bandeja está al día</h2><p>Las nuevas preguntas y conversaciones llegarán aquí mediante los webhooks de Mercado Libre.</p></div> : (
        <div className={styles.workspace}>
          <aside className={styles.list}>
            {visibleItems.map((item) => {
              const active = selected && itemKey(item.type, item.id) === itemKey(selected.type, selected.id);
              const question = item.type === 'question' ? item.data : null;
              const conversation = item.type === 'post-sale' ? item.data : null;
              const lastMessage = conversation?.messages?.[conversation.messages.length - 1];
              return <button key={itemKey(item.type, item.id)} className={active ? styles.active : ''} onClick={() => { setSelectedKey(itemKey(item.type, item.id)); setDraft(''); }}>
                <span><b>{item.type === 'question' ? 'PREVENTA' : 'POSVENTA'}</b>{item.pending && <em>{item.type === 'question' ? 'Responder' : `${conversation.unreadCount} nuevo(s)`}</em>}</span>
                <strong>{question?.product?.name || conversation?.order?.orderNumber || `Paquete ${item.id}`}</strong>
                <p>{question?.text || lastMessage?.text || 'Conversación sin mensajes visibles'}</p>
                <small>{fmtDate(item.date)}</small>
              </button>;
            })}
          </aside>
          {selected && <main className={styles.detail}>
            {selected.type === 'question' ? <QuestionDetail item={selected.data} /> : <ConversationDetail item={selected.data} />}
            <section className={styles.controls}>
              <h3>Seguimiento interno</h3>
              <div>
                <label>Estado<select value={selected.data.internalStatus} disabled={busy} onChange={(event) => update({ internalStatus: event.target.value })}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>Responsable<input defaultValue={selected.data.assignedTo || ''} onBlur={(event) => update({ assignedTo: event.target.value })} placeholder="Nombre del asesor" /></label>
                {selected.type === 'post-sale' && selected.data.unreadCount > 0 && <button onClick={markRead} disabled={busy}><i className="fas fa-check-double" /> Marcar leído</button>}
              </div>
            </section>
            <ReplyBox selected={selected} draft={draft} setDraft={setDraft} busy={busy} onSubmit={submitReply} />
            <section className={styles.audit}><h3>Trazabilidad</h3>{selectedActivities.length ? selectedActivities.map((activity) => <div key={activity.id}><b>{activity.action}</b><span>{activity.actorName || 'Sistema'} · {fmtDate(activity.createdAt)}</span></div>) : <p>Sin movimientos internos registrados todavía.</p>}</section>
          </main>}
        </div>
      )}
    </div>
  );
};

const QuestionDetail = ({ item }) => <section className={styles.card}>
  <div className={styles.title}><div><span>Pregunta #{item.externalQuestionId}</span><h2>{item.product?.name || item.itemId}</h2><small>{item.product?.sku || 'Producto sin vincular'} · {fmtDate(item.askedAt)}</small></div><strong className={item.status === 'UNANSWERED' ? styles.pending : styles.resolved}>{item.status}</strong></div>
  <article className={styles.question}><i className="fas fa-user" /><div><b>Pregunta del comprador</b><p>{item.text}</p></div></article>
  {item.answerText && <article className={styles.answer}><i className="fas fa-store" /><div><b>Respuesta de Tecnotitlan</b><p>{item.answerText}</p><small>{fmtDate(item.answeredAt)}</small></div></article>}
  <dl><div><dt>Publicación</dt><dd>{item.itemId}</dd></div><div><dt>Estado ML</dt><dd>{item.status}</dd></div><div><dt>Producto local</dt><dd>{item.product?.sku || 'Requiere vinculación'}</dd></div></dl>
</section>;

const ConversationDetail = ({ item }) => <section className={styles.card}>
  <div className={styles.title}><div><span>Paquete #{item.packId}</span><h2>{item.order?.orderNumber || 'Conversación posventa'}</h2><small>{item.order ? `${item.order.status} · ${fmtDate(item.lastMessageAt)}` : 'Pedido local pendiente de vincular'}</small></div><strong className={item.unreadCount ? styles.pending : styles.resolved}>{item.unreadCount ? `${item.unreadCount} sin leer` : item.status || 'Sin pendientes'}</strong></div>
  <div className={styles.messages}>{item.messages?.length ? item.messages.map((message) => <article key={message.id} className={message.direction === 'OUTBOUND' ? styles.outbound : styles.inbound}><b>{message.direction === 'OUTBOUND' ? 'Tecnotitlan' : 'Comprador'}</b><p>{message.text || 'Mensaje sin texto visible'}</p><small>{fmtDate(message.sentAt)}{message.moderationStatus ? ` · ${message.moderationStatus}` : ''}</small></article>) : <p>El comprador todavía no ha iniciado una conversación.</p>}</div>
</section>;

const ReplyBox = ({ selected, draft, setDraft, busy, onSubmit }) => {
  const isQuestion = selected.type === 'question';
  const canReply = isQuestion ? selected.data.status === 'UNANSWERED' : selected.data.messages?.length > 0 && selected.data.status === 'active';
  const maxLength = isQuestion ? 2000 : selected.data.maxMessageLength || 350;
  return <section className={styles.reply}><h3>{isQuestion ? 'Responder públicamente' : 'Responder al comprador'}</h3>
    {!canReply ? <p>{isQuestion ? 'Esta pregunta ya fue respondida o Mercado Libre no permite responderla.' : 'Por seguridad, sólo se puede responder cuando el comprador inició una conversación activa.'}</p> : <form onSubmit={onSubmit}><textarea rows="4" maxLength={maxLength} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={isQuestion ? 'Respuesta clara, breve y sin datos personales...' : 'Ayuda al comprador con su pedido; evita datos personales y enlaces externos...'} /><div><small>{draft.length}/{maxLength}</small><button disabled={busy || !draft.trim()}>Enviar por Mercado Libre</button></div></form>}
  </section>;
};

export default MercadoLibreCommunicationsScreen;
