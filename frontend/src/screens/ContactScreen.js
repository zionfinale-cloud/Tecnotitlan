import React, { useContext, useState } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import api from '../services/apiService';
import styles from './ContactScreen.module.css';

const initialForm = { name: '', email: '', phone: '', subject: '', message: '' };

const ContactScreen = () => {
  const { settings } = useContext(SettingsContext);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async event => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/support/tickets', { ...form, source: 'WEB' });
      setResult({ type: 'success', text: `${data.message} Folio: ${data.data.ticketNumber}` });
      setForm(initialForm);
    } catch (error) {
      setResult({ type: 'error', text: error.response?.data?.message || 'No pudimos enviar tu solicitud. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}><span>Atención Tecnotitlán</span><h1>¿Cómo podemos ayudarte?</h1><p>Escríbenos por WhatsApp, correo o abre un ticket. Si nuestro bot no puede resolverlo, un especialista continuará personalmente.</p></div>
      <div className={styles.layout}>
        <aside className={styles.channels}>
          {settings.social_whatsapp ? (
            <a href={settings.social_whatsapp} target="_blank" rel="noreferrer"><i className="fab fa-whatsapp"></i><span><strong>WhatsApp</strong><small>Respuesta inmediata con nuestro asistente</small></span></a>
          ) : (
            <div><i className="fab fa-whatsapp"></i><span><strong>WhatsApp</strong><small>Asistente automatizado disponible próximamente</small></span></div>
          )}
          <a href={`mailto:${settings.contact_email || 'contacto@tecnotitlan.com.mx'}`}><i className="fas fa-envelope"></i><span><strong>Correo electrónico</strong><small>{settings.contact_email || 'contacto@tecnotitlan.com.mx'}</small></span></a>
          <div><i className="fas fa-ticket-alt"></i><span><strong>Seguimiento por ticket</strong><small>Conserva tu folio para futuras consultas</small></span></div>
          <div className={styles.flow}><b>Así funciona</b><ol><li>Recibimos tu solicitud.</li><li>El asistente intenta resolverla.</li><li>Si hace falta, escala a una persona.</li><li>Te acompañamos hasta cerrarla.</li></ol></div>
        </aside>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.row}><label>Nombre<input required name="name" value={form.name} onChange={updateField} /></label><label>Email<input required type="email" name="email" value={form.email} onChange={updateField} /></label></div>
          <div className={styles.row}><label>Teléfono / WhatsApp<input name="phone" value={form.phone} onChange={updateField} /></label><label>Asunto<input required name="subject" value={form.subject} onChange={updateField} /></label></div>
          <label>Cuéntanos cómo podemos ayudarte<textarea required name="message" rows="7" value={form.message} onChange={updateField} /></label>
          {result && <p className={result.type === 'success' ? styles.success : styles.error}>{result.text}</p>}
          <button disabled={loading}>{loading ? 'Enviando...' : 'Crear ticket de soporte'} <i className="fas fa-arrow-right"></i></button>
        </form>
      </div>
    </div>
  );
};

export default ContactScreen;
