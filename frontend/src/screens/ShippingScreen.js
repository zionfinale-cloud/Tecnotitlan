import React, { useContext, useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/apiService';
import { getShippingAddress, saveShippingAddress } from '../utils/checkoutStorage';
import styles from './Checkout.module.css';

const emptyAddress = {
  name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Mexico',
  references: '',
};

const ShippingScreen = () => {
  const navigate = useNavigate();
  const { userInfo } = useContext(AuthContext);
  const [form, setForm] = useState(emptyAddress);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  useEffect(() => {
    setForm({ ...emptyAddress, ...getShippingAddress() });
  }, []);

  useEffect(() => {
    const loadSavedAddresses = async () => {
      if (!userInfo) return;

      try {
        const { data } = await api.get('/users/profile');
        const addresses = data.data?.addresses || [];
        setSavedAddresses(addresses);

        const stored = getShippingAddress();
        const hasStoredAddress = Boolean(stored.address || stored.street);
        if (!hasStoredAddress && addresses.length > 0) {
          const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];
          applySavedAddress(defaultAddress);
        }
      } catch (error) {
        setSavedAddresses([]);
      }
    };

    loadSavedAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo]);

  const applySavedAddress = (address) => {
    if (!address) return;
    setSelectedAddressId(address.id || '');
    setForm({
      name: address.recipient || '',
      phone: address.phone || '',
      address: address.street || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || 'Mexico',
      references: address.references || '',
    });
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSelectedAddressId('');
  };

  const selectAddress = (event) => {
    const address = savedAddresses.find((item) => item.id === event.target.value);
    applySavedAddress(address);
  };

  const submitHandler = (event) => {
    event.preventDefault();
    saveShippingAddress(form);
    navigate('/payment');
  };

  return (
    <Container className={styles.page}>
      <h1 className={styles.title}>Datos de envio</h1>
      <p className={styles.subtitle}>Captura los datos para preparar el pedido y la guia.</p>

      <form className={styles.grid} onSubmit={submitHandler}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Direccion de entrega</h2>
          {savedAddresses.length > 0 && (
            <label className={`${styles.field} ${styles.fieldFull}`}>
              Usar domicilio guardado
              <select className={styles.input} value={selectedAddressId} onChange={selectAddress}>
                <option value="">Capturar otro domicilio</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label} - {address.street}, {address.city}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Nombre de quien recibe
              <input className={styles.input} name="name" value={form.name} onChange={updateField} required />
            </label>
            <label className={styles.field}>
              Telefono / WhatsApp
              <input className={styles.input} name="phone" value={form.phone} onChange={updateField} required />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              Calle, numero y colonia
              <input className={styles.input} name="address" value={form.address} onChange={updateField} required />
            </label>
            <label className={styles.field}>
              Ciudad
              <input className={styles.input} name="city" value={form.city} onChange={updateField} required />
            </label>
            <label className={styles.field}>
              Estado
              <input className={styles.input} name="state" value={form.state} onChange={updateField} required />
            </label>
            <label className={styles.field}>
              Codigo postal
              <input className={styles.input} name="postalCode" value={form.postalCode} onChange={updateField} required />
            </label>
            <label className={styles.field}>
              Pais
              <input className={styles.input} name="country" value={form.country} onChange={updateField} required />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              Referencias
              <textarea className={styles.textarea} name="references" value={form.references} onChange={updateField} placeholder="Color de casa, entre calles, horario recomendado..." />
            </label>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/cart">Volver al carrito</Link>
            <button className={styles.primaryButton} type="submit">Continuar al pago</button>
          </div>
        </section>

        <aside className={styles.card}>
          <h2 className={styles.cardTitle}>Como trabajaremos el envio</h2>
          <div className={styles.instructions}>
            <h3>Pedido web</h3>
            <p>El pedido queda registrado y se confirma manualmente cuando recibamos el pago.</p>
            <p>Despues se genera la guia y el seguimiento aparecera en tu cuenta.</p>
          </div>
        </aside>
      </form>
    </Container>
  );
};

export default ShippingScreen;
