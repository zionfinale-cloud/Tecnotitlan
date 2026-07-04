import React from 'react';
import styles from './ProductListScreen.module.css';

const mailLinks = [
  {
    title: 'Webmail Tecnotitlan',
    description: 'Entrada principal para revisar correo corporativo desde el navegador.',
    url: 'https://webmail.tecnotitlan.com.mx',
    icon: 'fa-envelope-open-text',
  },
  {
    title: 'Correo de soporte',
    description: 'Bandeja recomendada para seguimiento de clientes, tickets y dudas.',
    url: 'mailto:soporte@tecnotitlan.com.mx',
    icon: 'fa-headset',
  },
  {
    title: 'Correo de ventas',
    description: 'Bandeja sugerida para cotizaciones, pedidos especiales y proveedores.',
    url: 'mailto:ventas@tecnotitlan.com.mx',
    icon: 'fa-handshake',
  },
];

const StaffMailScreen = () => (
  <>
    <div className={styles.toolbar}>
      <div>
        <h1 className={styles.title}>Correo del equipo</h1>
        <p className={styles.subtitle}>
          Acceso rapido para que trabajadores de Tecnotitlan revisen correo corporativo.
        </p>
      </div>
    </div>

    <div className={styles.card}>
      <div className={styles.formGrid}>
        {mailLinks.map((link) => (
          <a
            key={link.title}
            className={styles.secondaryButton}
            href={link.url}
            target={link.url.startsWith('http') ? '_blank' : undefined}
            rel={link.url.startsWith('http') ? 'noreferrer' : undefined}
            style={{
              display: 'block',
              padding: '1.25rem',
              textDecoration: 'none',
              borderRadius: '1rem',
            }}
          >
            <div style={{ fontSize: '1.8rem', color: '#00d084', marginBottom: '0.75rem' }}>
              <i className={`fas ${link.icon}`}></i>
            </div>
            <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{link.title}</strong>
            <span className={styles.muted}>{link.description}</span>
          </a>
        ))}
      </div>
    </div>

    <div className={styles.placeholderBox}>
      <p className={styles.placeholderText}>
        Nota: este apartado no guarda contrasenas de correo. Cada trabajador debe entrar con su cuenta corporativa.
      </p>
    </div>
  </>
);

export default StaffMailScreen;
