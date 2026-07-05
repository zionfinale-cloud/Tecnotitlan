import React, { useContext, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import styles from './AdminLayout.module.css';
import { SettingsContext } from '../context/SettingsContext';
import { AuthContext } from '../context/AuthContext';

const navLinks = [
    { to: '/admin/dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard' },
    { to: '/admin/productlist', icon: 'fa-box-open', text: 'Productos' },
    { to: '/admin/investments', icon: 'fa-wallet', text: 'Inversiones' },
    { to: '/admin/inventory', icon: 'fa-warehouse', text: 'Inventario' },
    { to: '/admin/channels', icon: 'fa-store', text: 'Canales' },
    { to: '/admin/orderlist', icon: 'fa-shipping-fast', text: 'Pedidos' },
    { to: '/mail', icon: 'fa-envelope', text: 'Correo' },
    { to: '/admin/whatsapp-chat', icon: 'fa-comments', text: 'WhatsApp', anyPermission: ['whatsapp:chat', 'support:update'] },
    { to: '/admin/userlist', icon: 'fa-users', text: 'Usuarios' },
    { to: '/admin/categorylist', icon: 'fa-list-alt', text: 'Categorias' },
    { to: '/admin/rolelist', icon: 'fa-lock', text: 'Roles' },
    { to: '/admin/support', icon: 'fa-headset', text: 'Soporte', permission: 'support:read' },
    { to: '/admin/settings', icon: 'fa-cogs', text: 'Configuracion', superAdminOnly: true },
];

const AdminLayout = () => {
    const { settings } = useContext(SettingsContext);
    const { userInfo } = useContext(AuthContext);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tecnotitlan-admin-sidebar') === 'collapsed');
    const isSuperAdmin = userInfo?.role === 'SUPER_ADMIN' || userInfo?.role?.name === 'SUPER_ADMIN';
    const userPermissions = userInfo?.permissions || [];

    const toggleSidebar = () => {
        setCollapsed((current) => {
            const next = !current;
            localStorage.setItem('tecnotitlan-admin-sidebar', next ? 'collapsed' : 'expanded');
            return next;
        });
    };

    const visibleLinks = navLinks.filter((item) => {
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (item.permission && !userPermissions.includes(item.permission)) return false;
        if (item.anyPermission && !item.anyPermission.some((permission) => userPermissions.includes(permission))) return false;
        return true;
    });

    return (
        <div className={styles.container}>
            <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} d-none d-md-block`}>
                <div className={styles.sidebarHeader}>
                    <button
                        className={styles.collapseButton}
                        type="button"
                        onClick={toggleSidebar}
                        title={collapsed ? 'Expandir menu' : 'Contraer menu'}
                    >
                        <i className={`fas ${collapsed ? 'fa-angle-right' : 'fa-angle-left'}`}></i>
                    </button>
                    <Link to="/" className={`${styles.brandLink} text-decoration-none d-block text-center`}>
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className={styles.logo} />
                        ) : (
                            <h2 className={styles.sidebarTitle}>
                                {settings?.siteName || 'TECNOTITLAN'}
                            </h2>
                        )}
                        <small className={styles.backText}>VOLVER A LA TIENDA</small>
                    </Link>
                </div>

                <nav>
                    <ul className={styles.nav}>
                        {visibleLinks.map((item) => (
                            <li key={item.to} className={styles.navItem}>
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
                                        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeLink : ''}`}
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

            <main className={styles.mainContent}>
                <div>
                    <div className={styles.contentCard}>
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
