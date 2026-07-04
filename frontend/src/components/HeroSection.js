import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Container } from 'react-bootstrap';
import { SettingsContext } from '../context/SettingsContext';
import styles from './HeroSection.module.css';

const parsePromos = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((promo) => promo?.title) : [];
  } catch (error) {
    return [];
  }
};

const HeroSection = () => {
  const { settings } = useContext(SettingsContext);
  const promos = useMemo(() => parsePromos(settings.home_promos), [settings.home_promos]);
  const [activePromo, setActivePromo] = useState(0);

  useEffect(() => {
    if (promos.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActivePromo((current) => (current + 1) % promos.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [promos.length]);

  const promo = promos[activePromo];
  const heroTitle = settings.hero_title || 'Tecnologia con raices,';
  const heroHighlight = settings.hero_highlight || 'poder sin limites.';
  const heroSubtitle = settings.hero_subtitle || 'Descubre gadgets, accesorios y soluciones tecnologicas seleccionadas para mejorar tu dia a dia.';
  const heroImage = settings.hero_image_url || '/images/dronbg.png';
  const ctaText = settings.hero_cta_text || 'Explorar tienda';
  const ctaHref = settings.hero_cta_href || '#products';

  return (
    <section className={styles.hero}>
      <Container className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>{settings.hero_eyebrow || 'Bienvenido a Tecnotitlan'}</span>
          <h1>{heroTitle}<br /><em>{heroHighlight}</em></h1>
          <p>{heroSubtitle}</p>
          <a href={ctaHref} className={styles.cta}>{ctaText} <i className="fas fa-arrow-right"></i></a>
          <div className={styles.miniBenefits}>
            <span><i className="fas fa-check-circle"></i> Productos seleccionados</span>
            <span><i className="fas fa-shield-alt"></i> Garantia con respaldo</span>
            <span><i className="fas fa-truck"></i> Envios seguros</span>
          </div>
        </div>
        <div className={styles.visual}>
          <div className={styles.glow}></div>
          <img src={heroImage} alt="Tecnologia Tecnotitlan" />
          {promo && (
            <article className={styles.promoCard}>
              <span>{promo.kicker || 'Promo Tecnotitlan'}</span>
              <strong>{promo.title}</strong>
              {promo.subtitle && <small>{promo.subtitle}</small>}
              {promo.href && <a href={promo.href}>Ver promo <i className="fas fa-arrow-right"></i></a>}
              {promos.length > 1 && (
                <div className={styles.promoDots}>
                  {promos.map((item, index) => (
                    <button
                      aria-label={`Ver promocion ${index + 1}`}
                      className={index === activePromo ? styles.promoDotActive : ''}
                      key={`${item.title}-${index}`}
                      onClick={() => setActivePromo(index)}
                      type="button"
                    />
                  ))}
                </div>
              )}
            </article>
          )}
        </div>
      </Container>
    </section>
  );
};

export default HeroSection;
