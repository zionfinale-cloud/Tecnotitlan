import React, { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, Container } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { SettingsContext } from '../context/SettingsContext';
import SearchBox from './SearchBox';
import HeaderSkeleton from './HeaderSkeleton';
import styles from './Header.module.css';

const Header = () => {
  const navigate = useNavigate();
  const { userInfo: user, logout, loading: authLoading } = useContext(AuthContext);
  const { cartItems, isItemJustAdded } = useContext(CartContext);
  const { settings, loading: settingsLoading } = useContext(SettingsContext);

  useEffect(() => {
    if (settings?.accentColor) {
      document.documentElement.style.setProperty('--cta-color', settings.accentColor);
    }
  }, [settings]);

  const logoutHandler = () => {
    logout();
    navigate('/login');
  };

  const totalCartItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const canAccessAdminPanel = user?.permissions?.includes('access:admin_panel');
  const isLoading = authLoading || settingsLoading;

  if (isLoading) {
    return <HeaderSkeleton />;
  }

  // Lógica del Logo: Usa el siteName o un fallback, y aplica el acento.
  const siteName = (settings?.siteName || 'TECNOTITLÁN').toUpperCase();
  const logoHtml = siteName.replace(/Á/g, `<span class="${styles.accent}">Á</span>`);

  return (
    <header className={styles.header}>
      <Container>
        <div className={styles.navContainer}>
          <Link to="/" className={styles.logoContainer}>
            {settings?.logoUrl && (
              <img src={settings.logoUrl} alt={siteName} className={styles.logoImage} onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <div className={styles.logoText}>
                <span dangerouslySetInnerHTML={{ __html: logoHtml }}></span>
            </div>
          </Link>

          <div className={styles.searchContainer}>
            <SearchBox />
          </div>

          <nav className={styles.navActions}>
            <Link to="/cart" className={`${styles.cartLink} ${isItemJustAdded ? styles.pulse : ''}`}>
              <i className={`fas fa-shopping-cart ${styles.cartIcon}`}></i>
              <span className={styles.cartLabel}>Carrito</span>
              {totalCartItems > 0 && <span className={styles.cartBadge}>{totalCartItems}</span>}
            </Link>

            {user ? (
              <Dropdown align="end">
                <Dropdown.Toggle as="a" className={styles.navLink}>
                  <div className={styles.avatarContainer}>
                    <i className="fas fa-user"></i>
                  </div>
                  <span className={styles.userName}>{user.name}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu className={styles.dropdownMenu}>
                  <Dropdown.Item as={Link} to="/profile">Perfil</Dropdown.Item>
                  {canAccessAdminPanel && <Dropdown.Item as={Link} to="/admin/dashboard">Panel Admin</Dropdown.Item>}
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={logoutHandler} className="text-danger">Cerrar Sesión</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Link to="/login" className={styles.navLink}>
                <i className="fas fa-user"></i> <span className={styles.loginText}>Entrar</span>
              </Link>
            )}
          </nav>
        </div>
        <div className={styles.mobileSearchContainer}>
          <SearchBox />
        </div>
      </Container>
    </header>
  );
};

export default Header;
