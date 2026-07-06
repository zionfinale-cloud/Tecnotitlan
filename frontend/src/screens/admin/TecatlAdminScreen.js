import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './TecatlAdminScreen.module.css';

const emptyArticle = {
  id: null,
  title: '',
  category: 'general',
  tags: '',
  content: '',
  isActive: true,
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
};

const TecatlAdminScreen = () => {
  const [activeTab, setActiveTab] = useState('conversations');
  const [profile, setProfile] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [articles, setArticles] = useState([]);
  const [articleForm, setArticleForm] = useState(emptyArticle);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedPreview = useMemo(() => (
    selectedConversation?.messages?.[selectedConversation.messages.length - 1]?.content || ''
  ), [selectedConversation]);

  const loadProfile = async () => {
    const { data } = await api.get('/admin/tecatl/profile');
    setProfile(data.data.profile);
  };

  const loadConversations = async () => {
    const { data } = await api.get('/admin/tecatl/conversations');
    setConversations(data.data.conversations || []);
  };

  const loadKnowledge = async () => {
    const { data } = await api.get('/admin/tecatl/knowledge');
    setArticles(data.data.articles || []);
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadProfile(), loadConversations(), loadKnowledge()]);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar Tecatl.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConversation = async (conversation) => {
    setError('');
    try {
      const { data } = await api.get(`/admin/tecatl/conversations/${conversation.id}`);
      setSelectedConversation(data.data.conversation);
      setActiveTab('conversations');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la conversacion.');
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put('/admin/tecatl/profile', profile);
      setProfile(data.data.profile);
      setSuccess('Perfil de Tecatl actualizado.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedConversation || !reply.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/tecatl/conversations/${selectedConversation.id}/reply`, { content: reply });
      setSelectedConversation(data.data.conversation);
      setReply('');
      await loadConversations();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo enviar la respuesta.');
    } finally {
      setSaving(false);
    }
  };

  const closeConversation = async () => {
    if (!selectedConversation) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/tecatl/conversations/${selectedConversation.id}/close`);
      setSelectedConversation(data.data.conversation);
      await loadConversations();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cerrar la conversacion.');
    } finally {
      setSaving(false);
    }
  };

  const editArticle = (article) => {
    setArticleForm({
      ...article,
      tags: (article.tags || []).join(', '),
    });
    setActiveTab('knowledge');
  };

  const saveArticle = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      ...articleForm,
      tags: articleForm.tags,
    };

    try {
      if (articleForm.id) {
        await api.put(`/admin/tecatl/knowledge/${articleForm.id}`, payload);
        setSuccess('Articulo actualizado.');
      } else {
        await api.post('/admin/tecatl/knowledge', payload);
        setSuccess('Articulo creado.');
      }
      setArticleForm(emptyArticle);
      await loadKnowledge();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el articulo.');
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (articleId) => {
    setSaving(true);
    setError('');
    try {
      await api.delete(`/admin/tecatl/knowledge/${articleId}`);
      if (articleForm.id === articleId) setArticleForm(emptyArticle);
      await loadKnowledge();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el articulo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Asistente conversacional</p>
          <h1>Tecatl</h1>
          <p>Atiende dudas, recomienda productos y escala a humanos sin exponer costos ni datos sensibles.</p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={loadAll}>
          <i className="fas fa-sync-alt"></i> Actualizar
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      {loading ? (
        <div className={styles.card}>Cargando Tecatl...</div>
      ) : (
        <>
          <nav className={styles.tabs}>
            <button type="button" className={activeTab === 'conversations' ? styles.activeTab : ''} onClick={() => setActiveTab('conversations')}>
              Conversaciones
            </button>
            <button type="button" className={activeTab === 'knowledge' ? styles.activeTab : ''} onClick={() => setActiveTab('knowledge')}>
              Conocimiento
            </button>
            <button type="button" className={activeTab === 'profile' ? styles.activeTab : ''} onClick={() => setActiveTab('profile')}>
              Perfil
            </button>
          </nav>

          {activeTab === 'conversations' && (
            <section className={styles.workspace}>
              <aside className={styles.list}>
                <div className={styles.listHeader}>
                  <strong>Conversaciones</strong>
                  <span>{conversations.length}</span>
                </div>
                {conversations.length === 0 ? (
                  <div className={styles.empty}>Aun no hay conversaciones.</div>
                ) : conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`${styles.rowButton} ${selectedConversation?.id === conversation.id ? styles.rowButtonActive : ''}`}
                    onClick={() => openConversation(conversation)}
                  >
                    <span>{conversation.customerName || conversation.customerEmail || conversation.externalUserId || conversation.channel}</span>
                    <small>{conversation.messages?.[0]?.content || 'Sin mensajes'}</small>
                    <em>{conversation.status}</em>
                  </button>
                ))}
              </aside>

              <div className={styles.conversationPanel}>
                {selectedConversation ? (
                  <>
                    <div className={styles.conversationHeader}>
                      <div>
                        <strong>{selectedConversation.customerName || selectedConversation.customerEmail || 'Visitante web'}</strong>
                        <span>{selectedConversation.channel} / {selectedConversation.intent || 'sin intent'}</span>
                      </div>
                      <button className={styles.secondaryButton} type="button" onClick={closeConversation} disabled={saving}>
                        Cerrar
                      </button>
                    </div>
                    <div className={styles.messages}>
                      {selectedConversation.messages.map((message) => (
                        <article
                          className={`${styles.message} ${message.role === 'USER' ? styles.incoming : styles.outgoing}`}
                          key={message.id}
                        >
                          <strong>{message.role === 'USER' ? 'Cliente' : message.role === 'HUMAN' ? 'Equipo' : 'Tecatl'}</strong>
                          <p>{message.content}</p>
                          <small>{formatDate(message.createdAt)}</small>
                        </article>
                      ))}
                    </div>
                    <form className={styles.replyBox} onSubmit={sendReply}>
                      <textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder={`Responder sobre: ${selectedPreview.slice(0, 80)}`}
                      />
                      <button className={styles.primaryButton} type="submit" disabled={saving || !reply.trim()}>
                        Responder
                      </button>
                    </form>
                  </>
                ) : (
                  <div className={styles.empty}>Selecciona una conversacion para verla.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'knowledge' && (
            <section className={styles.knowledgeGrid}>
              <form className={styles.card} onSubmit={saveArticle}>
                <h2>{articleForm.id ? 'Editar conocimiento' : 'Nuevo conocimiento'}</h2>
                <label>
                  Titulo
                  <input value={articleForm.title} onChange={(event) => setArticleForm({ ...articleForm, title: event.target.value })} />
                </label>
                <label>
                  Categoria
                  <input value={articleForm.category} onChange={(event) => setArticleForm({ ...articleForm, category: event.target.value })} />
                </label>
                <label>
                  Etiquetas
                  <input value={articleForm.tags} onChange={(event) => setArticleForm({ ...articleForm, tags: event.target.value })} placeholder="envio, guia, garantia" />
                </label>
                <label>
                  Contenido
                  <textarea value={articleForm.content} onChange={(event) => setArticleForm({ ...articleForm, content: event.target.value })} />
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={articleForm.isActive}
                    onChange={(event) => setArticleForm({ ...articleForm, isActive: event.target.checked })}
                  />
                  Activo
                </label>
                <div className={styles.actions}>
                  <button className={styles.primaryButton} type="submit" disabled={saving}>
                    Guardar
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={() => setArticleForm(emptyArticle)}>
                    Limpiar
                  </button>
                </div>
              </form>

              <div className={styles.card}>
                <h2>Base de conocimiento</h2>
                <div className={styles.articleList}>
                  {articles.map((article) => (
                    <article key={article.id} className={styles.article}>
                      <div>
                        <strong>{article.title}</strong>
                        <span>{article.category} / {(article.tags || []).join(', ') || 'sin etiquetas'}</span>
                      </div>
                      <p>{article.content}</p>
                      <div className={styles.actions}>
                        <button className={styles.secondaryButton} type="button" onClick={() => editArticle(article)}>Editar</button>
                        <button className={styles.dangerButton} type="button" onClick={() => deleteArticle(article.id)}>Eliminar</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'profile' && profile && (
            <form className={styles.card} onSubmit={saveProfile}>
              <h2>Perfil de Tecatl</h2>
              <div className={styles.formGrid}>
                <label>
                  Nombre
                  <input value={profile.name || ''} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
                </label>
                <label>
                  Avatar URL
                  <input value={profile.avatarUrl || ''} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} />
                </label>
                <label className={styles.fullField}>
                  Tono
                  <input value={profile.tone || ''} onChange={(event) => setProfile({ ...profile, tone: event.target.value })} />
                </label>
                <label className={styles.fullField}>
                  Mensaje inicial
                  <textarea value={profile.welcomeMessage || ''} onChange={(event) => setProfile({ ...profile, welcomeMessage: event.target.value })} />
                </label>
                <label className={styles.fullField}>
                  Mensaje de fallback
                  <textarea value={profile.fallbackMessage || ''} onChange={(event) => setProfile({ ...profile, fallbackMessage: event.target.value })} />
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={profile.isActive}
                    onChange={(event) => setProfile({ ...profile, isActive: event.target.checked })}
                  />
                  Tecatl activo
                </label>
              </div>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                Guardar perfil
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default TecatlAdminScreen;
