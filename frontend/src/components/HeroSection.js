import React from 'react';
import { Container } from 'react-bootstrap';
import styles from './HeroSection.module.css';

const HeroSection = () => (
  <section className={styles.hero}>
    <Container className={styles.inner}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>Bienvenido a Tecnotitlán</span>
        <h1>Tecnología con raíces,<br />poder <em>sin límites.</em></h1>
        <p>Descubre gadgets, accesorios y soluciones tecnológicas seleccionadas para mejorar tu día a día.</p>
        <a href="#products" className={styles.cta}>Explorar tienda <i className="fas fa-arrow-right"></i></a>
        <div className={styles.miniBenefits}>
          <span><i className="fas fa-check-circle"></i> Productos seleccionados</span>
          <span><i className="fas fa-shield-alt"></i> Garantía con respaldo</span>
          <span><i className="fas fa-truck"></i> Envíos seguros</span>
        </div>
      </div>
      <div className={styles.visual}>
        <div className={styles.glow}></div>
        <img src="/images/dronbg.png" alt="Drone tecnológico Tecnotitlán" />
      </div>
    </Container>
  </section>
);

export default HeroSection;
