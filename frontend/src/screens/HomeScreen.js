import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import HeroSection from '../components/HeroSection';
import ProductList from '../components/ProductList';
import useProductFilters from '../hooks/useProductFilters';
import styles from './HomeScreen.module.css';

const categoryIcons = ['fa-helicopter', 'fa-mobile-alt', 'fa-gamepad', 'fa-headphones', 'fa-clock', 'fa-battery-full'];

const HomeScreen = () => {
  const { products, loading, error, pages, page, setPage, categories, selectedCategory, setSelectedCategory, collectionTitle, clearFilters } = useProductFilters();

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
          {categories.map((category, index) => (
            <button key={category.id} onClick={() => setSelectedCategory(category.slug)} className={selectedCategory === category.slug ? styles.activeCategory : ''}>
              <i className={`fas ${categoryIcons[index % categoryIcons.length]}`}></i>
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
