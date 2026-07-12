import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const sections = [
  {
    title: 'Correos transaccionales',
    description: 'Activacion de cuenta, confirmaciones de compra y avisos al cliente.',
    keys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'SUPPORT_EMAIL'],
  },
  {
    title: 'Automatizacion y soporte',
    description: 'WhatsApp administrativo, Evolution API y webhooks para n8n.',
    keys: [
      'API_PUBLIC_URL',
      'ADMIN_WHATSAPP_NUMBER',
      'WHATSAPP_PROVIDER',
      'WHATSAPP_AUTO_CONNECT',
      'WHATSAPP_AUTH_DIR',
      'EVOLUTION_API_URL',
      'EVOLUTION_API_KEY',
      'EVOLUTION_INSTANCE',
      'EVOLUTION_WEBHOOK_URL',
      'EVOLUTION_WEBHOOK_SECRET',
      'N8N_ORDER_WEBHOOK_URL',
      'N8N_SUPPORT_WEBHOOK_URL',
    ],
  },
  {
    title: 'Pagos y marketplaces',
    description: 'Credenciales privadas para Stripe, PayPal, Mercado Libre y TikTok Shop.',
    keys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_CLIENT_ID', 'MERCADOLIBRE_APP_ID', 'MERCADOLIBRE_CLIENT_SECRET', 'MERCADOLIBRE_REDIRECT_URI', 'TIKTOK_SHOP_APP_KEY', 'TIKTOK_SHOP_APP_SECRET', 'TIKTOK_SHOP_REDIRECT_URI', 'TIKTOK_SHOP_AUTH_BASE_URL', 'TIKTOK_SHOP_API_BASE_URL'],
  },
];

const SystemSettingsScreen = () => {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const byKey = useMemo(() => settings.reduce((acc, setting) => {
    acc[setting.key] = setting;
    return acc;
  }, {}), [settings]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const { data } = await api.get('/settings/system');
        setSettings(data.data || []);
        setForm((data.data || []).reduce((acc, setting) => {
          acc[setting.key] = setting.value || '';
          return acc;
        }, {}));
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar configuracion sensible.' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = settings.map((setting) => ({
        key: setting.key,
        value: form[setting.key] || '',
        type: setting.type || 'string',
      }));
      await api.put('/settings/system', { settings: payload });
      setMessage({ type: 'success', text: 'Configuracion guardada. Reinicia o redepliega la API si alguna integracion lo requiere.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo guardar configuracion.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando configuracion sensible...</div>;

  return (
    <form onSubmit={save}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Configuracion del sistema</h2>
          <p className={styles.subtitle}>Solo Super Admin. No expongas estas claves a vendedores ni al frontend publico.</p>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </div>

      {message && <div className={`${styles.notice} ${message.type === 'success' ? styles.success : styles.error}`}>{message.text}</div>}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {sections.map((section) => (
          <section className={styles.card} key={section.title}>
            <h3 className={styles.cardTitle}>{section.title}</h3>
            <p className={styles.subtitle}>{section.description}</p>
            <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
              {section.keys.map((key) => {
                const setting = byKey[key];
                if (!setting) return null;
                const isPassword = setting.type === 'password';
                return (
                  <label className={styles.field} key={key}>
                    <span className={styles.label}>
                      {setting.label || key}
                      {setting.source && <small style={{ color: '#64748b', marginLeft: '.35rem' }}>({setting.source})</small>}
                    </span>
                    <input
                      className={styles.input}
                      type={isPassword ? 'password' : 'text'}
                      value={form[key] || ''}
                      onChange={(event) => updateField(key, event.target.value)}
                      placeholder={setting.hasValue ? 'Configurado' : 'Sin configurar'}
                      autoComplete="off"
                    />
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryButton} type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </div>
    </form>
  );
};

export default SystemSettingsScreen;
