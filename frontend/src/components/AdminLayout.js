import React, { useContext, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import styles from './AdminLayout.module.css'; // Importamos los estilos CSS Modules
import { SettingsContext } from '../context/SettingsContext';
import { AuthContext } from '../context/AuthContext';

// Datos de navegación (Menú Lateral)
const navLinks = [
    { to: '/admin/dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard' },
    { to: '/admin/productlist', icon: 'fa-box-open', text: 'Productos' },
    { to: '/admin/investments', icon: 'fa-wallet', text: 'Inversiones' },
    { to: '/admin/inventory', icon: 'fa-warehouse', text: 'Inventario' },
    { to: '/admin/channels', icon: 'fa-store', text: 'Canales' },
    { to: '/admin/orderlist', icon: 'fa-shipping-fast', text: 'Pedidos' },
    { to: '/admin/mail', icon: 'fa-envelope', text: 'Correo' },
    { to: '/admin/userlist', icon: 'fa-users', text: 'Usuarios' },
    { to: '/admin/categorylist', icon: 'fa-list-alt', text: 'Categorías' }, // Agregamos Categorías
    { to: '/admin/rolelist', icon: 'fa-lock', text: 'Roles' },
    { to: '/admin/support', icon: 'fa-headset', text: 'Soporte', permission: 'support:read' },
    { to: '/admin/settings/storefront', icon: 'fa-paint-brush', text: 'Storefront' },
    { to: '/admin/settings/legal', icon: 'fa-gavel', text: 'Páginas Legales' },
];

const AdminLayout = () => {
    const { settings } = useContext(SettingsContext);
    const { userInfo } = useContext(AuthContext);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tecnotitlan-admin-sidebar') === 'collapsed');

    const toggleSidebar = () => {
        setCollapsed((current) => {
            const next = !current;
            localStorage.setItem('tecnotitlan-admin-sidebar', next ? 'collapsed' : 'expanded');
            return next;
        });
    };

    return (
        // Fondo gris claro para el área del contenido principal
        <div className={styles.container}>
            {/* -----------------------
                BARRA LATERAL (SIDEBAR)
                Estilo Oscuro con acentos Neon
               ----------------------- */}
            <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} d-none d-md-block`}>
                <div className={styles.sidebarHeader}>
                    <button
                        className={styles.collapseButton}
                        type="button"
                        onClick={toggleSidebar}
                        title={collapsed ? 'Expandir menú' : 'Contraer menú'}
                    >
                        <i className={`fas ${collapsed ? 'fa-angle-right' : 'fa-angle-left'}`}></i>
                    </button>
                    {/* Enlace para volver a la tienda */}
                    <Link to="/" className={`${styles.brandLink} text-decoration-none d-block text-center`}>
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className={styles.logo} />
                        ) : (
                            <h2 className={styles.sidebarTitle}>
                                {settings?.siteName || 'TECNOTITLÁN'}
                            </h2>
                        )}
                        <small className={styles.backText}>VOLVER A LA TIENDA</small>
                    </Link>
                </div>
                    <nav>
                        <ul className={styles.nav}>
                            {navLinks.filter(item => !item.permission || userInfo?.permissions?.includes(item.permission)).map((item, index) => (
                                <li key={index} className={styles.navItem}>
                                    {item.href ? (
                                        <a
                                            href={item.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={styles.navLink}
                                        >
                                            <div className={styles.iconContainer}>
                                                <i className={`fas ${item.icon}`}></i>
                                            </div>
                                            <span className={styles.linkText}>{item.text}</span>
                                        </a>
                                    ) : (
                                        <NavLink 
                                            to={item.to} 
                                            className={({ isActive }) => 
                                                `${styles.navLink} ${isActive ? styles.activeLink : ''}`
                                            }
                                        >
                                            <div className={styles.iconContainer}>
                                                <i className={`fas ${item.icon}`}></i>
                                            </div>
                                            <span className={styles.linkText}>{item.text}</span>
                                        </NavLink>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
            </aside>
            
            {/* -----------------------
                CONTENIDO PRINCIPAL
               ----------------------- */}
            <main className={styles.mainContent}>
                <div>
                    {/* Contenedor Blanco tipo Tarjeta para las páginas hijas */}
                    <div className={styles.contentCard}>
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
