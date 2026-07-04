import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import api from '../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
import { getPaymentMethod, getShippingAddress } from '../utils/checkoutStorage';
import styles from './Checkout.module.css';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const paymentLabels = {
  BANK_TRANSFER: 'Transferencia bancaria / SPEI',
  MERCADO_LIBRE: 'Pago por Mercado Libre',
  WHATSAPP: 'Confirmar por WhatsApp',
  Stripe: 'Tarjeta con Stripe',
  PayPal: 'PayPal',
};

const paymentInstructions = {
  BANK_TRANSFER: [
    'Tu pedido quedara apartado como pendiente de pago.',
    'El equipo Tecnotitlan te compartira los datos SPEI y validara el comprobante.',
    'Tambien puedes mandar el comprobante a hola@tecnotitlan.com.mx.',
  ],
  MERCADO_LIBRE: [
    'Registraremos tu pedido y te daremos seguimiento para pagarlo por Mercado Libre.',
    'Esta opcion sirve cuando convenga usar la proteccion y logistica de Mercado Libre.',
  ],
  WHATSAPP: [
    'Registraremos tu pedido y lo atenderemos manualmente por WhatsApp.',
    'Es buena opcion para dudas, cambios o compras con atencion personalizada.',
  ],
};

const hasShippingAddress = (shippingAddress) =>
  Boolean(shippingAddress?.name && shippingAddress?.phone && shippingAddress?.address);

const PlaceOrderScreen = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useContext(CartContext);
  const [shippingAddress] = useState(getShippingAddress());
  const [paymentMethod] = useState(getPaymentMethod());
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hasShippingAddress(shippingAddress)) navigate('/shipping');
  }, [navigate, shippingAddress]);

  const totals = useMemo(() => {
    const itemsPrice = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
    const shippingPrice = itemsPrice > 1000 ? 0 : 99;
    const taxPrice = itemsPrice * 0.16;
    const totalPrice = itemsPrice + shippingPrice + taxPrice;
    return { itemsPrice, shippingPrice, taxPrice, totalPrice };
  }, [cartItems]);

  const placeOrderHandler = async () => {
    setPlacingOrder(true);
    setError('');
    try {
      const { data } = await api.post('/orders', {
        orderItems: cartItems.map((item) => ({
          product: item.product,
          qty: item.qty,
        })),
        shippingAddress,
        paymentMethod,
      });
      const order = data.data.order;
      clearCart();
      navigate(paymentMethod === 'Stripe' ? `/order/${order.id}/pay` : `/order/${order.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos crear el pedido. Revisa la informacion e intenta otra vez.');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <Container className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Tu carrito esta vacio</h1>
          <p className={styles.subtitle}>Agrega productos antes de generar un pedido.</p>
          <Link className={styles.primaryButton} to="/">Volver a la tienda</Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className={styles.page}>
      <h1 className={styles.title}>Revisar pedido</h1>
      <p className={styles.subtitle}>Ultimo paso: confirma tu compra y el equipo Tecnotitlan le dara seguimiento.</p>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Productos</h2>
          <div className={styles.summaryList}>
            {cartItems.map((item) => (
              <article className={styles.summaryItem} key={item.product}>
                <img
                  src={resolveAssetUrl(item.image)}
                  alt={item.name}
                  onError={(event) => { event.currentTarget.src = FALLBACK_PRODUCT_IMAGE; }}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small className={styles.muted}>Cantidad: {item.qty}</small>
                </span>
                <strong>{currency.format(Number(item.price || 0) * Number(item.qty || 0))}</strong>
              </article>
            ))}
          </div>

          <div className={styles.instructions}>
            <h3>Direccion</h3>
            <p>{shippingAddress.name} - {shippingAddress.phone}</p>
            <p>{shippingAddress.address}, {shippingAddress.city}, {shippingAddress.state}, CP {shippingAddress.postalCode}</p>
          </div>

          <div className={styles.instructions}>
            <h3>{paymentLabels[paymentMethod] || paymentMethod}</h3>
            {(paymentInstructions[paymentMethod] || ['El pedido queda pendiente de confirmacion.']).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <aside className={styles.card}>
          <h2 className={styles.cardTitle}>Resumen</h2>
          <div className={styles.totals}>
            <div className={styles.totalRow}><span>Productos</span><strong>{currency.format(totals.itemsPrice)}</strong></div>
            <div className={styles.totalRow}><span>Envio estimado</span><strong>{currency.format(totals.shippingPrice)}</strong></div>
            <div className={styles.totalRow}><span>IVA estimado</span><strong>{currency.format(totals.taxPrice)}</strong></div>
            <div className={`${styles.totalRow} ${styles.grandTotal}`}><span>Total</span><strong>{currency.format(totals.totalPrice)}</strong></div>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/payment">Editar pago</Link>
            <button className={styles.primaryButton} type="button" onClick={placeOrderHandler} disabled={placingOrder}>
              {placingOrder ? 'Creando pedido...' : 'Confirmar pedido'}
            </button>
          </div>
        </aside>
      </div>
    </Container>
  );
};

export default PlaceOrderScreen;
