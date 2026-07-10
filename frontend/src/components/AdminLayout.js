import React, { useContext, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import styles from './AdminLayout.module.css';
import { SettingsContext } from '../context/SettingsContext';
import { AuthContext } from '../context/AuthContext';
import api from '../services/apiService';
import { hasPermission, isSuperAdmin as checkIsSuperAdmin } from '../utils/permissions';

const navGroups = [
    {
        label: 'Ventas',
        links: [
            { to: '/admin/dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard' },
            { to: '/admin/orderlist', icon: 'fa-shipping-fast', text: 'Pedidos', permission: 'order:read' },
            { to: '/admin/channels', icon: 'fa-store', text: 'Canales', permission: 'product:read' },
        ],
    },
    {
        label: 'Catalogo',
        links: [
            { to: '/admin/productlist', icon: 'fa-box-open', text: 'Productos', permission: 'product:read' },
            { to: '/admin/categorylist', icon: 'fa-list-alt', text: 'Categorias', permission: 'category:read' },
            { to: '/admin/inventory', icon: 'fa-warehouse', text: 'Inventario', permission: 'product:read' },
            { to: '/admin/investments', icon: 'fa-wallet', text: 'Inversiones', permission: 'finance:read_costs' },
        ],
    },
    {
        label: 'Atencion',
        links: [
            { to: '/admin/whatsapp-chat', icon: 'fa-comments', text: 'WhatsApp', anyPermission: ['whatsapp:chat', 'support:update'] },
            { to: '/admin/tecatl', icon: 'fa-robot', text: 'Tecatl', anyPermission: ['tecatl:read', 'tecatl:reply', 'tecatl:knowledge'] },
            { to: '/mail', icon: 'fa-envelope', text: 'Correo', anyPermission: ['mail:read', 'mail:send'] },
            { to: '/admin/support', icon: 'fa-headset', text: 'Soporte', permission: 'support:read' },
        ],
    },
    {
        label: 'Administracion',
        links: [
            { to: '/admin/userlist', icon: 'fa-users', text: 'Usuarios', permission: 'user:read' },
            { to: '/admin/rolelist', icon: 'fa-lock', text: 'Roles', permission: 'role:read' },
            { to: '/admin/settings', icon: 'fa-cogs', text: 'Configuracion', superAdminOnly: true },
        ],
    },
];

const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        oscillator.frequency.setValueAtTime(660, context.currentTime + 0.08);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.2);
    } catch (error) {
        // El navegador puede bloquear audio hasta que haya interaccion del usuario.
    }
};

const AdminLayout = () => {
    const { settings } = useContext(SettingsContext);
    const { userInfo } = useContext(AuthContext);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tecnotitlan-admin-sidebar') === 'collapsed');
    const [whatsappUnread, setWhatsappUnread] = useState(0);
    const previousWhatsappUnread = useRef(0);
    const isSuperAdmin = checkIsSuperAdmin(userInfo);

    const toggleSidebar = () => {
        setCollapsed((current) => {
            const next = !current;
            localStorage.setItem('tecnotitlan-admin-sidebar', next ? 'collapsed' : 'expanded');
            return next;
        });
    };

    const canViewLink = (item) => {
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (item.permission && !hasPermission(userInfo, item.permission)) return false;
        if (item.anyPermission && !item.anyPermission.some((permission) => hasPermission(userInfo, permission))) return false;
        return true;
    };

    const visibleGroups = navGroups
        .map((group) => ({ ...group, links: group.links.filter(canViewLink) }))
        .filter((group) => group.links.length > 0);

    const visibleLinks = visibleGroups.flatMap((group) => group.links);

    const canPollWhatsApp = visibleLinks.some((item) => item.to === '/admin/whatsapp-chat');

    useEffect(() => {
        if (!canPollWhatsApp) return undefined;

        const loadWhatsAppUnread = async () => {
            try {
                const { data } = await api.get('/integrations/whatsapp/chats');
                const totalUnread = (data.data || []).reduce((sum, chat) => sum + (Number(chat.unreadCount) || 0), 0);
                if (previousWhatsappUnread.current > 0 && totalUnread > previousWhatsappUnread.current) {
                    playNotificationSound();
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('Tecnotitlan WhatsApp', {
                            body: `Tienes ${totalUnread - previousWhatsappUnread.current} mensaje(s) nuevo(s).`,
                        });
                    }
                }
                previousWhatsappUnread.current = totalUnread;
                setWhatsappUnread(totalUnread);
            } catch (error) {
                // Si la migracion aun no esta aplicada o el usuario no tiene permiso, no bloqueamos el panel.
            }
        };

        loadWhatsAppUnread();
        const timer = window.setInterval(loadWhatsAppUnread, 15000);
        return () => window.clearInterval(timer);
    }, [canPollWhatsApp]);

    const renderLinkContent = (item) => {
        const unreadCount = item.to === '/admin/whatsapp-chat' ? whatsappUnread : 0;
        return (
            <>
                <div className={styles.iconContainer}>
                    <i className={`fas ${item.icon}`}></i>
                    {unreadCount > 0 && (
                        <span className={styles.notificationBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </div>
                <span className={styles.linkText}>{item.text}</span>
            </>
        );
    };

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
                        {visibleGroups.map((group) => (
                            <li key={group.label} className={styles.navGroup}>
                                <span className={styles.navGroupLabel}>{group.label}</span>
                                <ul className={styles.navGroupList}>
                                    {group.links.map((item) => (
                                        <li key={item.to} className={styles.navItem}>
                                            {item.href ? (
                                                <a
                                                    href={item.href}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className={styles.navLink}
                                                >
                                                    {renderLinkContent(item)}
                                                </a>
                                            ) : (
                                                <NavLink
                                                    to={item.to}
                                                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeLink : ''}`}
                                                >
                                                    {renderLinkContent(item)}
                                                </NavLink>
                                            )}
                                        </li>
                                    ))}
                                </ul>
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
