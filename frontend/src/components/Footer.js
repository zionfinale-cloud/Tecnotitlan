import React, { useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom'; // CRÍTICO: Importar Link para navegación SPA
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
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Instagram"><i className="fab fa-instagram"></i></a>
                <a href="https://whatsapp.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="WhatsApp"><i className="fab fa-whatsapp"></i></a>
            </div>
          </Col>

          {/* Columna 2: Navegación */}
          <Col xs={6} md={2} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>Navegación</h5>
            <ul className={styles.footerNav}>
              <li><Link to="/" className={styles.footerLink}>Inicio</Link></li>
              <li><Link to="/cart" className={styles.footerLink}>Carrito</Link></li>
              <li><Link to="/profile" className={styles.footerLink}>Perfil</Link></li>
            </ul>
          </Col>

          {/* Columna 3: Legal */}
          <Col xs={6} md={3} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>Legal</h5>
            <ul className={styles.footerNav}>
              <li><Link to="/privacy" className={styles.footerLink}>Política de Privacidad</Link></li>
              <li><Link to="/terms" className={styles.footerLink}>Términos de Servicio</Link></li>
            </ul>
          </Col>

          {/* Columna 4: Pagos (Íconos de tarjetas) */}
          <Col md={3}>
            <h5 className={styles.footerTitle}>Pagos Seguros</h5>
            <div className={styles.paymentIcons} aria-label="Métodos de pago aceptados">
                <i className={`fab fa-cc-paypal ${styles.paymentIcon}`} title="PayPal"></i>
                <i className={`fab fa-cc-mastercard ${styles.paymentIcon}`} title="Mastercard"></i>
                <i className={`fab fa-cc-visa ${styles.paymentIcon}`} title="Visa"></i>
                <i className={`fab fa-cc-amex ${styles.paymentIcon}`} title="American Express"></i>
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