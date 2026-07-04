import React, { useContext, useEffect, useMemo } from 'react';
import { Container } from 'react-bootstrap';
import HeroSection from '../components/HeroSection';
import ProductList from '../components/ProductList';
import { SettingsContext } from '../context/SettingsContext';
import useProductFilters from '../hooks/useProductFilters';
import styles from './HomeScreen.module.css';

const CATEGORY_ICON_RULES = [
  { terms: ['auricular', 'audifono', 'audifonos', 'audio'], icon: 'fa-headphones' },
  { terms: ['bocina', 'bocinas', 'speaker', 'parlante'], icon: 'fa-volume-up' },
  { terms: ['cargador', 'cargadores', 'carga'], icon: 'fa-plug' },
  { terms: ['cable', 'cables'], icon: 'fa-usb' },
  { terms: ['reloj', 'relojes', 'watch', 'wearable'], icon: 'fa-clock' },
  { terms: ['drone', 'drones'], icon: 'fa-helicopter' },
  { terms: ['gaming', 'juego', 'consola'], icon: 'fa-gamepad' },
  { terms: ['power', 'bateria', 'battery', 'energia'], icon: 'fa-battery-full' },
  { terms: ['celular', 'telefono', 'phone', 'movil'], icon: 'fa-mobile-alt' },
];

const normalizeCategoryText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getCategoryIcon = (category, iconOverrides = {}) => {
  if (iconOverrides[category.slug]) return iconOverrides[category.slug];
  const text = normalizeCategoryText(`${category.name || ''} ${category.slug || ''}`);
  return CATEGORY_ICON_RULES.find((rule) => rule.terms.some((term) => text.includes(term)))?.icon || 'fa-microchip';
};

const HomeScreen = () => {
  const { settings } = useContext(SettingsContext);
  const { products, loading, error, pages, page, setPage, categories, selectedCategory, setSelectedCategory, collectionTitle, clearFilters } = useProductFilters();
  const iconOverrides = useMemo(() => {
    try {
      return JSON.parse(settings.home_category_icons || '{}');
    } catch (error) {
      return {};
    }
  }, [settings.home_category_icons]);

  useEffect(() => {
    const anchor = window.location.hash;
    if (anchor) document.querySelector(anchor)?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [page, collectionTitle]);

  return (
    <div className={styles.page}>
      <HeroSection />
      <Container>
        <section id="categories" className={styles.categories}>
          {categories.map((category) => (
            <button key={category.id} onClick={() => setSelectedCategory(category.slug)} className={selectedCategory === category.slug ? styles.activeCategory : ''}>
              <i className={`fas ${getCategoryIcon(category, iconOverrides)}`}></i>
              <span><strong>{category.name}</strong><small>Explorar productos</small></span>
            </button>
          ))}
          <button onClick={clearFilters}><i className="fas fa-th"></i><span><strong>Ver todas</strong><small>Las categorías</small></span></button>
        </section>

        <section id="products" className={styles.products}>
          <div className={styles.sectionHeader}>
            <div><span className={styles.kicker}>Selección Tecnotitlán</span><h2>{collectionTitle}</h2></div>
            <button onClick={clearFilters}>Ver todos <i className="fas fa-arrow-right"></i></button>
          </div>
          <ProductList products={products} loading={loading} error={error} pages={pages} page={page} setPage={setPage} />
        </section>

        <section className={styles.trustGrid}>
          <article><i className="fas fa-truck"></i><span><strong>Envíos a todo México</strong><small>Rápidos, seguros y confiables</small></span></article>
          <article><i className="fas fa-shield-alt"></i><span><strong>Compra 100% segura</strong><small>Protegemos tus datos siempre</small></span></article>
          <article><i className="fas fa-award"></i><span><strong>Garantía y respaldo</strong><small>Te respaldamos en cada compra</small></span></article>
          <article><i className="fas fa-headset"></i><span><strong>Atención personalizada</strong><small>Estamos para ayudarte</small></span></article>
        </section>

        <section className={styles.aboutBanner}>
          <span className={styles.aboutIcon}><i className="fas fa-microchip"></i></span>
          <div><h3>Tecnología seleccionada por expertos</h3><p>Solo productos de calidad, probados y respaldados.</p></div>
          <a href="#footer">Conoce más sobre nosotros <i className="fas fa-arrow-right"></i></a>
        </section>
      </Container>
    </div>
  );
};

export default HomeScreen;
