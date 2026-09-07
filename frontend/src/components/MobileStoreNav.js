import React, { useContext } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import styles from './MobileStoreNav.module.css';

const MobileStoreNav = () => {
  const { userInfo } = useContext(AuthContext);
  const { cartItems } = useContext(CartContext);
  const cartCount = cartItems.reduce((total, item) => total + Number(item.qty || 0), 0);

  return (
    <nav className={styles.nav} aria-label="Navegación rápida de la tienda">
      <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : undefined}>
        <i className="fas fa-home" /><span>Inicio</span>
      </NavLink>
      <Link to="/?collection=all#categories">
        <i className="fas fa-th-large" /><span>Categorías</span>
      </Link>
      <NavLink to="/cart" className={({ isActive }) => isActive ? styles.active : undefined}>
        <span className={styles.icon}><i className="fas fa-shopping-cart" />{cartCount > 0 && <b>{cartCount > 99 ? '99+' : cartCount}</b>}</span>
        <span>Carrito</span>
      </NavLink>
      <NavLink to={userInfo ? '/profile' : '/login'} className={({ isActive }) => isActive ? styles.active : undefined}>
        <i className="fas fa-user" /><span>{userInfo ? 'Mi cuenta' : 'Ingresar'}</span>
      </NavLink>
    </nav>
  );
};

export default MobileStoreNav;
