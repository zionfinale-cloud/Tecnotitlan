import React, { useContext, useEffect, useState } from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import api from '../services/apiService';
import styles from './ProfileScreen.module.css';

const statusLabels = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PROCESSING: 'Procesando',
  PENDING_FULFILLMENT: 'Preparando envio',
  SHIPPED: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const emptyProfile = {
  firstName: '',
  lastName: '',
  secondLastName: '',
  email: '',
  phone: '',
};

const emptyAddress = {
  label: 'Principal',
  recipient: '',
  phone: '',
  street: '',
  neighborhood: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Mexico',
  references: '',
  isDefault: true,
};

const fullNameFromProfile = (profile) => [profile.firstName, profile.lastName, profile.secondLastName]
  .filter(Boolean)
  .join(' ');

const ProfileScreen = () => {
  const { userInfo, logout, updateProfile } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(emptyProfile);
  const [addresses, setAddresses] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [profileError, setProfileError] = useState('');
  const navigate = useNavigate();

  const fetchProfile = async () => {
    setLoadingProfile(true);
    setProfileError('');
    try {
      const { data } = await api.get('/users/profile');
      const nextProfile = data.data || {};
      setProfile({
        firstName: nextProfile.firstName || '',
        lastName: nextProfile.lastName || '',
        secondLastName: nextProfile.secondLastName || '',
        email: nextProfile.email || '',
        phone: nextProfile.phone || '',
      });
      setAddresses((nextProfile.addresses || []).map((address, index) => ({
        ...emptyAddress,
        ...address,
        isDefault: index === 0 || Boolean(address.isDefault),
      })));
    } catch (err) {
      setProfileError('No pudimos cargar tus datos. Intenta de nuevo en un momento.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchMyOrders = async ({ silent = false } = {}) => {
    if (!silent) setLoadingOrders(true);
    try {
      const { data } = await api.get('/orders/myorders');
      setOrders(data.data.orders || []);
    } catch (err) {
      if (!silent) setOrdersError('No pudimos consultar tus pedidos en este momento.');
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!userInfo) return;
    fetchProfile();
    fetchMyOrders();
    const interval = setInterval(() => {
      fetchMyOrders({ silent: true });
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo]);

  if (!userInfo) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const updateProfileField = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const updateAddressField = (index, event) => {
    const { name, value } = event.target;
    setAddresses((current) => current.map((address, addressIndex) => (
      addressIndex === index ? { ...address, [name]: value } : address
    )));
  };

  const addAddress = () => {
    setAddresses((current) => [
      ...current,
      {
        ...emptyAddress,
        label: `Direccion ${current.length + 1}`,
        recipient: fullNameFromProfile(profile),
        phone: profile.phone,
        isDefault: current.length === 0,
      },
    ]);
  };

  const removeAddress = (index) => {
    setAddresses((current) => current
      .filter((_, addressIndex) => addressIndex !== index)
      .map((address, addressIndex) => ({ ...address, isDefault: addressIndex === 0 })));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      const { data } = await api.put('/users/profile', {
        ...profile,
        addresses,
      });
      if (data.data) {
        updateProfile(data.data);
      }
      await fetchProfile();
      showNotification('Tu informacion quedo actualizada.', 'success');
    } catch (err) {
      const message = err.response?.data?.message || 'No pudimos guardar tu informacion.';
      setProfileError(message);
      showNotification(message, 'danger');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Container className={styles.page}>
      <section className={styles.profileCard}>
        <div className={styles.avatarLarge}>{userInfo.name?.charAt(0).toUpperCase() || 'U'}</div>
        <div>
          <span className={styles.eyebrow}>Mi cuenta</span>
          <h1>{userInfo.name}</h1>
          <p>{userInfo.customerNumber ? `Cliente ${userInfo.customerNumber} - ` : ''}{userInfo.email}</p>
        </div>
        <Button variant="outline-light" onClick={handleLogout}>Cerrar sesion</Button>
      </section>

      <section className={styles.accountPanel}>
        <div className={styles.sectionHeader}>
          <span className={styles.eyebrow}>Datos del cliente</span>
          <h2>Informacion y domicilios</h2>
          <p>Estos datos nos ayudan a confirmar compras, enviar guias y dar seguimiento sin friccion.</p>
        </div>

        {loadingProfile && <div className={styles.notice}>Cargando tu informacion...</div>}
        {profileError && <div className={styles.errorBox}>{profileError}</div>}

        {!loadingProfile && (
          <form className={styles.form} onSubmit={saveProfile}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Nombre
                <input name="firstName" value={profile.firstName} onChange={updateProfileField} required />
              </label>
              <label className={styles.field}>
                Apellidos
                <input name="lastName" value={profile.lastName} onChange={updateProfileField} required />
              </label>
              <label className={styles.field}>
                Segundo apellido
                <input name="secondLastName" value={profile.secondLastName} onChange={updateProfileField} />
              </label>
              <label className={styles.field}>
                Correo
                <input name="email" type="email" value={profile.email} onChange={updateProfileField} required />
              </label>
              <label className={styles.field}>
                Celular / WhatsApp
                <input name="phone" type="tel" inputMode="tel" value={profile.phone} onChange={updateProfileField} required />
              </label>
            </div>

            <div className={styles.addressHeader}>
              <div>
                <h3>Domicilios de entrega</h3>
                <p>Puedes guardar casa, trabajo o cualquier punto donde recibas pedidos.</p>
              </div>
              <button type="button" className={styles.secondaryAction} onClick={addAddress}>Agregar domicilio</button>
            </div>

            {addresses.length === 0 && (
              <div className={styles.notice}>Aun no tienes domicilios guardados.</div>
            )}

            <div className={styles.addressList}>
              {addresses.map((address, index) => (
                <article className={styles.addressCard} key={address.id || index}>
                  <div className={styles.addressCardHeader}>
                    <strong>Domicilio {index + 1}</strong>
                    <button type="button" onClick={() => removeAddress(index)}>Quitar</button>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      Etiqueta
                      <input name="label" value={address.label} onChange={(event) => updateAddressField(index, event)} />
                    </label>
                    <label className={styles.field}>
                      Recibe
                      <input name="recipient" value={address.recipient} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={styles.field}>
                      Telefono
                      <input name="phone" type="tel" inputMode="tel" value={address.phone} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      Calle, numero y colonia
                      <input name="street" value={address.street} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={styles.field}>
                      Colonia / zona
                      <input name="neighborhood" value={address.neighborhood || ''} onChange={(event) => updateAddressField(index, event)} />
                    </label>
                    <label className={styles.field}>
                      Ciudad
                      <input name="city" value={address.city} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={styles.field}>
                      Estado
                      <input name="state" value={address.state} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={styles.field}>
                      Codigo postal
                      <input name="postalCode" value={address.postalCode} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={styles.field}>
                      Pais
                      <input name="country" value={address.country} onChange={(event) => updateAddressField(index, event)} required />
                    </label>
                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      Referencias
                      <textarea name="references" value={address.references || ''} onChange={(event) => updateAddressField(index, event)} placeholder="Entre calles, color de fachada, horario recomendado..." />
                    </label>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.actions}>
              <button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Guardando...' : 'Guardar informacion'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section id="orders" className={styles.orders}>
        <div className={styles.sectionHeader}><span className={styles.eyebrow}>Seguimiento</span><h2>Mis pedidos</h2></div>
        {loadingOrders && <div className={styles.notice}>Consultando tus pedidos...</div>}
        {ordersError && <div className={styles.notice}>{ordersError}</div>}
        {!loadingOrders && !ordersError && orders.length === 0 && <div className={styles.notice}>Todavia no tienes pedidos. Tu historial aparecera aqui.</div>}
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
