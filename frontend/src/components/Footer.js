import React, { useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { SettingsContext } from '../context/SettingsContext';
import { FaFacebookF, FaInstagram, FaWhatsapp, FaYoutube, FaTiktok } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer = () => {
  const { settings } = useContext(SettingsContext);
  const siteName = settings?.siteName || 'Tecnotitlan';
  const contactEmail = settings.contact_email || 'contacto@tecnotitlan.com.mx';
  const socials = {
    social_facebook: { icon: <FaFacebookF />, name: 'Facebook' },
    social_instagram: { icon: <FaInstagram />, name: 'Instagram' },
    social_whatsapp: { icon: <FaWhatsapp />, name: 'WhatsApp' },
    social_tiktok: { icon: <FaTiktok />, name: 'TikTok' },
    social_youtube: { icon: <FaYoutube />, name: 'YouTube' },
  };

  return (
    <footer id="footer" className={styles.footer}>
      <Container>
        <Row className="mb-5">
          <Col md={4} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>{siteName}</h5>
            <p className={styles.footerText}>Tecnología con raíces, poder sin límites.</p>
            <div className={styles.socialIcons}>{Object.entries(socials).map(([key, social]) => settings[key] ? <a key={key} href={settings[key]} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label={social.name}>{social.icon}</a> : null)}</div>
          </Col>
          <Col xs={6} md={2} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>Navegación</h5>
            <ul className={styles.footerNav}><li><Link to="/" className={styles.footerLink}>Inicio</Link></li><li><Link to="/cart" className={styles.footerLink}>Carrito</Link></li><li><Link to="/profile" className={styles.footerLink}>Mi cuenta</Link></li></ul>
          </Col>
          <Col xs={6} md={3} className="mb-4 mb-md-0">
            <h5 className={styles.footerTitle}>Ayuda</h5>
            <ul className={styles.footerNav}><li><Link to="/contact" className={styles.footerLink}>Contacto y soporte</Link></li><li><a href={`mailto:${contactEmail}`} className={styles.footerLink}>{contactEmail}</a></li><li><Link to="/privacy-policy" className={styles.footerLink}>Política de privacidad</Link></li><li><Link to="/terms-of-service" className={styles.footerLink}>Términos de servicio</Link></li></ul>
          </Col>
          <Col md={3}><h5 className={styles.footerTitle}>Pagos seguros</h5><div className={styles.paymentIcons}><i className="fab fa-cc-paypal"></i><i className="fab fa-cc-mastercard"></i><i className="fab fa-cc-visa"></i><i className="fab fa-cc-amex"></i></div></Col>
        </Row>
        <Row><Col className={styles.copyright}>&copy; {new Date().getFullYear()} {siteName}. Todos los derechos reservados. Desarrollado por {siteName}.</Col></Row>
      </Container>
    </footer>
  );
};

export default Footer;
