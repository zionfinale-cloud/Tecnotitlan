import React, { useContext, useEffect, useState } from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/apiService';
import styles from './ProfileScreen.module.css';

const statusLabels = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PROCESSING: 'Procesando',
  PENDING_FULFILLMENT: 'Preparando envío',
  SHIPPED: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const ProfileScreen = () => {
  const { userInfo, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!userInfo) return;
    api.get('/orders/myorders')
      .then(({ data }) => setOrders(data.data.orders || []))
      .catch(() => setOrdersError('No pudimos consultar tus pedidos en este momento.'))
      .finally(() => setLoadingOrders(false));
  }, [userInfo]);

  if (!userInfo) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container className={styles.page}>
      <section className={styles.profileCard}>
        <div className={styles.avatarLarge}>{userInfo.name?.charAt(0).toUpperCase() || 'U'}</div>
        <div>
          <span className={styles.eyebrow}>Mi cuenta</span>
          <h1>{userInfo.name}</h1>
          <p>{userInfo.customerNumber ? `Cliente ${userInfo.customerNumber} · ` : ''}{userInfo.email}</p>
        </div>
        <Button variant="outline-light" onClick={handleLogout}>Cerrar sesión</Button>
      </section>

      <section id="orders" className={styles.orders}>
        <div className={styles.sectionHeader}><span className={styles.eyebrow}>Seguimiento</span><h2>Mis pedidos</h2></div>
        {loadingOrders && <div className={styles.notice}>Consultando tus pedidos...</div>}
        {ordersError && <div className={styles.notice}>{ordersError}</div>}
        {!loadingOrders && !ordersError && orders.length === 0 && <div className={styles.notice}>Todavía no tienes pedidos. Tu historial aparecerá aquí.</div>}
        <div className={styles.orderGrid}>
          {orders.map(order => (
            <article key={order.id} className={styles.orderCard}>
              <div><small>Pedido</small><strong>{order.orderNumber}</strong></div>
              <div><small>Estado</small><span>{statusLabels[order.status] || order.status}</span></div>
              <div><small>Total</small><strong>${order.totalPrice.toFixed(2)}</strong></div>
              <div><small>Fecha</small><span>{new Date(order.createdAt).toLocaleDateString('es-MX')}</span></div>
              <Link to={`/order/${order.id}`}>Ver seguimiento <i className="fas fa-arrow-right"></i></Link>
            </article>
          ))}
        </div>
      </section>
    </Container>
  );
};

export default ProfileScreen;
