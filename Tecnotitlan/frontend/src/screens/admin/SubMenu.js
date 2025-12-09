import React, { useContext } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { SettingsContext } from '../../context/SettingsContext';
import styles from './SubMenu.module.css';

const SubMenu = () => {
  const { settings } = useContext(SettingsContext);
  const siteName = settings?.siteName || 'Tecnotitlan';

  return (
    <nav className={styles.submenu}>
      <div className={styles.logoContainer}>
        <Link to="/" className={styles.logoText}>{siteName}</Link>
      </div>

      <div className={styles.navGroup}>
        <span className={styles.groupTitle}>Principal</span>
        <NavLink to="/admin/dashboard" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <i className={`fas fa-tachometer-alt ${styles.navIcon}`}></i> Dashboard
        </NavLink>
      </div>

      <div className={styles.navGroup}>
        <span className={styles.groupTitle}>Gestión</span>
        <NavLink to="/admin/productlist" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <i className={`fas fa-box-open ${styles.navIcon}`}></i> Productos
        </NavLink>
        <NavLink to="/admin/orderlist" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <i className={`fas fa-receipt ${styles.navIcon}`}></i> Pedidos
        </NavLink>
        <NavLink to="/admin/userlist" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <i className={`fas fa-users ${styles.navIcon}`}></i> Usuarios
        </NavLink>
        <NavLink to="/admin/roles" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <i className={`fas fa-user-shield ${styles.navIcon}`}></i> Roles
        </NavLink>
      </div>

      <div className={styles.navGroup}>
        <span className={styles.groupTitle}>Sistema</span>
        <NavLink to="/admin/settings/whatsapp" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <i className={`fas fa-cogs ${styles.navIcon}`}></i> Configuración
        </NavLink>
      </div>
    </nav>
  );
};

export default SubMenu;
