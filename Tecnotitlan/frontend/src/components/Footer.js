import React, { useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { SettingsContext } from '../context/SettingsContext'; 
import styles from './Footer.module.css';

const Footer = () => {
  const { settings } = useContext(SettingsContext);
  const siteName = settings?.siteName || 'Tecnotitlan';
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container>
        <Row className="mb-5">
          
          {/* Columna 1: Info de la Marca */}
          <Col md={4} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>{siteName}</h5>
            <p className={styles.footerText}>
              Tecnología con Raíces, Poder sin Límites.
            </p>
            <div className={styles.socialIcons}>
                <a href="#facebook" className={styles.socialLink}><i className="fab fa-facebook-f"></i></a>
                <a href="#instagram" className={styles.socialLink}><i className="fab fa-instagram"></i></a>
                <a href="#whatsapp" className={styles.socialLink}><i className="fab fa-whatsapp"></i></a>
            </div>
          </Col>

          {/* Columna 2: Navegación */}
          <Col xs={6} md={2} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>Navegación</h5>
            <ul className={styles.footerNav}>
              <li><a href="/" className={styles.footerLink}>Inicio</a></li>
              <li><a href="/cart" className={styles.footerLink}>Carrito</a></li>
              <li><a href="/profile" className={styles.footerLink}>Perfil</a></li>
            </ul>
          </Col>

          {/* Columna 3: Legal */}
          <Col xs={6} md={3} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>Legal</h5>
            <ul className={styles.footerNav}>
              <li><a href="#privacy" className={styles.footerLink}>Política de Privacidad</a></li>
              <li><a href="#terms" className={styles.footerLink}>Términos de Servicio</a></li>
            </ul>
          </Col>

          {/* Columna 4: Pagos (Íconos de tarjetas) */}
          <Col md={3}>
            <h5 className={styles.footerTitle}>Pagos Seguros</h5>
            <div className={styles.paymentIcons}>
                <i className="fab fa-cc-paypal text-gray-400"></i>
                <i className="fab fa-cc-mastercard text-gray-400"></i>
                <i className="fab fa-cc-visa text-gray-400"></i>
                <i className="fab fa-cc-amex text-gray-400"></i>
            </div>
          </Col>
        </Row>
        
        {/* Sección de Copyright */}
        <Row>
          <Col className={styles.copyright}>
            &copy; {currentYear} {siteName}. Todos los derechos reservados. Desarrollado con el poder del Cóndor.
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;