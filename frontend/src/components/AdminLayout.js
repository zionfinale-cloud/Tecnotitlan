import React, { useContext } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import styles from './AdminLayout.module.css'; // Importamos los estilos CSS Modules
import { SettingsContext } from '../context/SettingsContext';
import { AuthContext } from '../context/AuthContext';

// Datos de navegación (Menú Lateral)
const navLinks = [
    { to: '/admin/dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard' },
    { to: '/admin/productlist', icon: 'fa-box-open', text: 'Productos' },
    { to: '/admin/inventory', icon: 'fa-warehouse', text: 'Inventario' },
    { to: '/admin/channels', icon: 'fa-store', text: 'Canales' },
    { to: '/admin/orderlist', icon: 'fa-shipping-fast', text: 'Pedidos' },
    { to: '/admin/userlist', icon: 'fa-users', text: 'Usuarios' },
    { to: '/admin/categorylist', icon: 'fa-list-alt', text: 'Categorías' }, // Agregamos Categorías
    { to: '/admin/rolelist', icon: 'fa-lock', text: 'Roles' },
    { to: '/admin/support', icon: 'fa-headset', text: 'Soporte', permission: 'support:read' },
    { to: '/admin/settings/legal', icon: 'fa-gavel', text: 'Páginas Legales' },
];

const AdminLayout = () => {
    const { settings } = useContext(SettingsContext);
    const { userInfo } = useContext(AuthContext);

    return (
        // Fondo gris claro para el área del contenido principal
        <div className={styles.container}>
            {/* -----------------------
                BARRA LATERAL (SIDEBAR)
                Estilo Oscuro con acentos Neon
               ----------------------- */}
            <aside className={`${styles.sidebar} d-none d-md-block`}>
                <div className={styles.sidebarHeader}>
                    {/* Enlace para volver a la tienda */}
                    <Link to="/" className="text-decoration-none d-block text-center">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '50px', maxWidth: '100%' }} />
                        ) : (
                            <h2 className={styles.sidebarTitle}>
                                {settings?.siteName || 'TECNOTITLÁN'}
                            </h2>
                        )}
                        <small className="text-muted d-block mt-2" style={{ fontSize: '0.7rem' }}>VOLVER A LA TIENDA</small>
                    </Link>
                </div>
                    <nav>
                        <ul className={styles.nav}>
                            {navLinks.filter(item => !item.permission || userInfo?.permissions?.includes(item.permission)).map((item, index) => (
                                <li key={index} className={styles.navItem}>
                                    <NavLink 
                                        to={item.to} 
                                        className={({ isActive }) => 
                                            `${styles.navLink} ${isActive ? styles.activeLink : ''}`
                                        }
                                    >
                                        <div className={styles.iconContainer}>
                                            <i className={`fas ${item.icon}`}></i>
                                        </div>
                                        <span>{item.text}</span>
                                    </NavLink>
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
