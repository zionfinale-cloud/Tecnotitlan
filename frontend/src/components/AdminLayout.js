import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import styles from './AdminLayout.module.css'; // Importamos los estilos CSS Modules

// Datos de navegación (Menú Lateral)
const navLinks = [
    { to: '/admin/dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard' },
    { to: '/admin/productlist', icon: 'fa-box-open', text: 'Productos' },
    { to: '/admin/orderlist', icon: 'fa-shipping-fast', text: 'Pedidos' },
    { to: '/admin/userlist', icon: 'fa-users', text: 'Usuarios' },
    { to: '/admin/categorylist', icon: 'fa-list-alt', text: 'Categorías' }, // Agregamos Categorías
    { to: '/admin/rolelist', icon: 'fa-lock', text: 'Roles' },
    { to: '/admin/settings/legal', icon: 'fa-gavel', text: 'Páginas Legales' },
];

const AdminLayout = () => {
    return (
        // Fondo gris claro para el área del contenido principal
        <div className={styles.container}>
            {/* -----------------------
                BARRA LATERAL (SIDEBAR)
                Estilo Oscuro con acentos Neon
               ----------------------- */}
            <aside className={`${styles.sidebar} d-none d-md-block`}>
                <div className={styles.sidebarHeader}>
                    <h2 className={styles.sidebarTitle}>
                        Panel Admin
                    </h2>
                </div>
                    <nav>
                        <ul className={styles.nav}>
                            {navLinks.map((item, index) => (
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