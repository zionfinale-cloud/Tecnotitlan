import React, { useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { SettingsContext } from '../context/SettingsContext';
import { FaFacebookF, FaInstagram, FaWhatsapp, FaYoutube, FaTiktok } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer = () => {
  const { settings } = useContext(SettingsContext);
  const siteName = settings?.siteName || 'Tecnotitlan';
  const currentYear = new Date().getFullYear();

  // Mapeo de claves de configuración a componentes de iconos.
  const socialMediaMap = {
    facebookUrl: { icon: <FaFacebookF />, name: 'Facebook' },
    instagramUrl: { icon: <FaInstagram />, name: 'Instagram' },
    whatsappUrl: { icon: <FaWhatsapp />, name: 'WhatsApp' },
    tiktokUrl: { icon: <FaTiktok />, name: 'TikTok' },
    youtubeUrl: { icon: <FaYoutube />, name: 'YouTube' },
  };

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
              {/* Renderiza dinámicamente los iconos solo si la URL existe en la configuración */}
              {Object.entries(socialMediaMap).map(([key, { icon, name }]) => {
                const url = settings[key];
                return url ? (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label={name}>
                    {icon}
                  </a>
                ) : null;
              })}
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
              <li><Link to="/privacy-policy" className={styles.footerLink}>Política de Privacidad</Link></li>
              <li><Link to="/terms-of-service" className={styles.footerLink}>Términos de Servicio</Link></li>
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