import React, { useContext, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Dropdown, Container } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { SettingsContext } from '../context/SettingsContext';
import SearchBox from './SearchBox';
import HeaderSkeleton from './HeaderSkeleton';
import styles from './Header.module.css';
import { canAccessAdminPanel } from '../utils/permissions';

const Header = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('tecnotitlan-theme') || 'dark');
  const navigate = useNavigate();
  const { userInfo: user, logout, loading: authLoading } = useContext(AuthContext);
  const { cartItems, isItemJustAdded } = useContext(CartContext);
  const { settings, loading: settingsLoading } = useContext(SettingsContext);

  useEffect(() => document.documentElement.style.setProperty('--cta-color', settings?.accentColor || '#75f238'), [settings]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tecnotitlan-theme', theme);
  }, [theme]);
  if (authLoading || settingsLoading) return <HeaderSkeleton />;

  const totalCartItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const canAccessPanel = canAccessAdminPanel(user);
  const siteName = (settings?.siteName || 'TECNOTITLÁN').toUpperCase();
  const logoUrl = settings?.logoUrl || '/images/logo.png';
  const logoutHandler = () => { logout(); navigate('/login'); };

  return (
    <header className={styles.header}>
      <Container className={styles.topRow}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark}>
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className={styles.brandLogo} />
            ) : (
              <i className="fas fa-microchip"></i>
            )}
          </span>
          <span className={styles.brandCopy}><strong>{siteName}</strong><small>Tecnología con raíces, poder sin límites.</small></span>
        </Link>
        <div className={styles.searchContainer}><SearchBox /></div>
        <nav className={styles.actions}>
          <span className={styles.serviceItem}><i className="fas fa-truck"></i><span>Envíos a<br />todo México</span></span>
          <span className={styles.serviceItem}><i className="fas fa-shield-alt"></i><span>Compra<br />segura</span></span>
          <Link to="/cart" className={`${styles.actionLink} ${isItemJustAdded ? styles.pulse : ''}`}>
            <i className="fas fa-shopping-cart"></i><span>Carrito</span>{totalCartItems > 0 && <b>{totalCartItems}</b>}
          </Link>
          <button className={styles.themeToggle} onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`} title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}>
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          {user ? (
            <Dropdown align="end">
              <Dropdown.Toggle as="button" className={styles.accountButton}><i className="fas fa-user-circle"></i><span>{user.name}</span></Dropdown.Toggle>
              <Dropdown.Menu className={styles.dropdownMenu}>
                <Dropdown.Item as={Link} to="/profile">Mi cuenta</Dropdown.Item>
                {canAccessPanel && <Dropdown.Item as={Link} to="/admin/dashboard">Panel de trabajo</Dropdown.Item>}
                <Dropdown.Divider /><Dropdown.Item onClick={logoutHandler}>Cerrar sesión</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : <Link to="/login" className={styles.actionLink}><i className="fas fa-user"></i><span>Mi cuenta</span></Link>}
        </nav>
      </Container>
      <Container className={styles.mobileSearch}><SearchBox /></Container>
      <div className={styles.navBar}>
        <Container className={styles.navRow}>
          <Link to="/?collection=all#categories" className={styles.categoriesButton}><i className="fas fa-bars"></i> Todas las categorías</Link>
          <nav className={styles.mainNav}>
            <NavLink to="/">Inicio</NavLink>
            <Link to="/?collection=offers#products">Ofertas</Link>
            <Link to="/?collection=new#products">Novedades</Link>
            <Link to="/?collection=top#products">Más vendidos</Link>
            <Link to="/profile#orders">Seguimiento</Link>
            <Link to="/contact">Contacto</Link>
          </nav>
        </Container>
      </div>
    </header>
  );
};

export default Header;
