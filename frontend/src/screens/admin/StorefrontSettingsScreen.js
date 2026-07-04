import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './StorefrontSettingsScreen.module.css';

const iconOptions = [
  { value: 'fa-headphones', label: 'Audifonos' },
  { value: 'fa-volume-up', label: 'Bocinas' },
  { value: 'fa-plug', label: 'Cargadores' },
  { value: 'fa-usb', label: 'Cables' },
  { value: 'fa-clock', label: 'Relojes' },
  { value: 'fa-helicopter', label: 'Drones' },
  { value: 'fa-gamepad', label: 'Gaming' },
  { value: 'fa-battery-full', label: 'Energia' },
  { value: 'fa-mobile-alt', label: 'Celulares' },
  { value: 'fa-microchip', label: 'Tecnologia' },
  { value: 'fa-th', label: 'General' },
];

const emptyPromo = { kicker: '', title: '', subtitle: '', href: '' };

const defaults = {
  hero_eyebrow: 'Bienvenido a Tecnotitlan',
  hero_title: 'Tecnologia con raices,',
  hero_highlight: 'poder sin limites.',
  hero_subtitle: 'Descubre gadgets, accesorios y soluciones tecnologicas seleccionadas para mejorar tu dia a dia.',
  hero_cta_text: 'Explorar tienda',
  hero_cta_href: '#products',
  hero_image_url: '/images/dronbg.png',
};

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
};

const StorefrontSettingsScreen = () => {
  const [form, setForm] = useState(defaults);
  const [promos, setPromos] = useState([emptyPromo, emptyPromo, emptyPromo]);
  const [categories, setCategories] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const activePromos = useMemo(() => promos.filter((promo) => promo.title.trim()), [promos]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const [settingsResponse, categoriesResponse] = await Promise.all([
          api.get('/settings'),
          api.get('/categories'),
        ]);
        const settingsMap = (settingsResponse.data.data || []).reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {});

        setForm({ ...defaults, ...settingsMap });
        const nextPromos = parseJson(settingsMap.home_promos, []);
        setPromos([...nextPromos, emptyPromo, emptyPromo, emptyPromo].slice(0, 3));
        setCategoryIcons(parseJson(settingsMap.home_category_icons, {}));
        setCategories(categoriesResponse.data.data.categories || []);
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar Storefront.' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const updatePromo = (index, key, value) => {
    setPromos((current) => current.map((promo, promoIndex) => (
      promoIndex === index ? { ...promo, [key]: value } : promo
    )));
  };

  const uploadHeroImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateField('hero_image_url', data.filePath);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo subir la imagen.' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const settings = [
        ...Object.entries(form).map(([key, value]) => ({ key, value: String(value || ''), type: key.includes('subtitle') ? 'textarea' : 'string' })),
        { key: 'home_promos', value: JSON.stringify(activePromos), type: 'json' },
        { key: 'home_category_icons', value: JSON.stringify(categoryIcons), type: 'json' },
      ];

      await api.put('/settings', { settings });
      setMessage({ type: 'success', text: 'Storefront actualizado. Recarga la tienda para ver cambios.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No se pudo guardar Storefront.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando configuracion de Storefront...</div>;

  return (
    <form onSubmit={save}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Storefront / Home</h2>
          <p className={styles.subtitle}>Configura hero, promociones y los iconos visibles en la tienda.</p>
        </div>
        <button className={styles.primaryButton} disabled={saving} type="submit">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {message && <div className={`${styles.notice} ${message.type === 'success' ? styles.success : styles.error}`}>{message.text}</div>}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Hero principal</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Etiqueta</span>
              <input className={styles.input} value={form.hero_eyebrow} onChange={(event) => updateField('hero_eyebrow', event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>CTA texto</span>
              <input className={styles.input} value={form.hero_cta_text} onChange={(event) => updateField('hero_cta_text', event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Titulo</span>
              <input className={styles.input} value={form.hero_title} onChange={(event) => updateField('hero_title', event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Texto resaltado</span>
              <input className={styles.input} value={form.hero_highlight} onChange={(event) => updateField('hero_highlight', event.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.label}>Descripcion</span>
              <textarea className={styles.textarea} value={form.hero_subtitle} onChange={(event) => updateField('hero_subtitle', event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>CTA destino</span>
              <input className={styles.input} value={form.hero_cta_href} onChange={(event) => updateField('hero_cta_href', event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Imagen actual</span>
              <input className={styles.input} value={form.hero_image_url} onChange={(event) => updateField('hero_image_url', event.target.value)} />
            </label>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.label}>Subir imagen hero</span>
              <div className={styles.uploadRow}>
                <input className={styles.input} type="file" accept="image/*" onChange={uploadHeroImage} />
                {uploading && <strong>Subiendo...</strong>}
              </div>
              <img className={styles.preview} src={form.hero_image_url} alt="Hero preview" />
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Iconos de categorias</h3>
          <div className={styles.categoryRows}>
            {categories.map((category) => (
              <label className={styles.categoryRow} key={category.id}>
                <span className={styles.categoryName}>{category.name}</span>
                <select
                  className={styles.select}
                  value={categoryIcons[category.slug] || ''}
                  onChange={(event) => setCategoryIcons((current) => ({ ...current, [category.slug]: event.target.value }))}
                >
                  <option value="">Automatico</option>
                  {iconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.card} style={{ marginTop: '1rem' }}>
        <h3 className={styles.cardTitle}>Carrusel de promociones</h3>
        <div className={styles.promoGrid}>
          {promos.map((promo, index) => (
            <article className={styles.promoCard} key={index}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Kicker</span>
                  <input className={styles.input} value={promo.kicker} onChange={(event) => updatePromo(index, 'kicker', event.target.value)} placeholder="Oferta Tecnotitlan" />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Titulo</span>
                  <input className={styles.input} value={promo.title} onChange={(event) => updatePromo(index, 'title', event.target.value)} placeholder="Kit de viaje con descuento" />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Subtitulo</span>
                  <input className={styles.input} value={promo.subtitle} onChange={(event) => updatePromo(index, 'subtitle', event.target.value)} placeholder="Powerbank + cables + audifonos" />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Link</span>
                  <input className={styles.input} value={promo.href} onChange={(event) => updatePromo(index, 'href', event.target.value)} placeholder="/?collection=offers#products" />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button className={styles.secondaryButton} type="button" onClick={() => window.location.assign('/')}>Ver tienda</button>
        <button className={styles.primaryButton} disabled={saving} type="submit">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </form>
  );
};

export default StorefrontSettingsScreen;
