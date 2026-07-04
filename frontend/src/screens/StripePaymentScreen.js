import React, { useEffect, useMemo, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import api from '../services/apiService';
import { stripePublishableKey } from '../utils/runtimeEnv';
import styles from './Checkout.module.css';

const publishableKey = stripePublishableKey;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const StripePaymentForm = ({ order, clientSecret, paymentIntentId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const submitHandler = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/${order.id}`,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || 'No pudimos confirmar el pago con tarjeta.');
      setProcessing(false);
      return;
    }

    const confirmedIntentId = result.paymentIntent?.id || paymentIntentId;

    try {
      await api.post(`/orders/${order.id}/confirm-stripe-payment`, {
        paymentIntentId: confirmedIntentId,
      });
      navigate(`/order/${order.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'El pago fue procesado, pero no pudimos confirmarlo en Tecnotitlan.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={submitHandler}>
      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
      <PaymentElement />
      <div className={styles.actions}>
        <Link className={styles.secondaryButton} to={`/order/${order.id}`}>Pagar despues</Link>
        <button className={styles.primaryButton} type="submit" disabled={!stripe || processing}>
          {processing ? 'Procesando...' : 'Pagar con tarjeta'}
        </button>
      </div>
    </form>
  );
};

const StripePaymentScreen = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayment = async () => {
      setLoading(true);
      setError('');
      try {
        const orderResponse = await api.get(`/orders/${id}`);
        const nextOrder = orderResponse.data.data.order;
        setOrder(nextOrder);

        if (nextOrder.isPaid) return;
        if (nextOrder.paymentMethod !== 'Stripe') {
          setError('Este pedido no fue creado para pagarse con tarjeta.');
          return;
        }
        if (!publishableKey) {
          setError('El pago con tarjeta no esta configurado en el frontend.');
          return;
        }

        const intentResponse = await api.post(`/orders/${id}/create-payment-intent`);
        setClientSecret(intentResponse.data.clientSecret);
        setPaymentIntentId(intentResponse.data.paymentIntentId);
      } catch (err) {
        setError(err.response?.data?.message || 'No pudimos preparar el pago con tarjeta.');
      } finally {
        setLoading(false);
      }
    };

    loadPayment();
  }, [id]);

  const options = useMemo(() => ({
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#00d084',
        borderRadius: '14px',
      },
    },
  }), [clientSecret]);

  if (loading) return <Container className={styles.page}><div className={styles.card}>Preparando pago seguro...</div></Container>;

  return (
    <Container className={styles.page}>
      <h1 className={styles.title}>Pago seguro con tarjeta</h1>
      <p className={styles.subtitle}>Tecnotitlan no guarda los datos de tu tarjeta.</p>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Tarjeta</h2>
          {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
          {order?.isPaid && <div className={`${styles.notice} ${styles.success}`}>Este pedido ya esta pagado.</div>}
          {clientSecret && stripePromise && order && !order.isPaid && (
            <Elements stripe={stripePromise} options={options}>
              <StripePaymentForm order={order} clientSecret={clientSecret} paymentIntentId={paymentIntentId} />
            </Elements>
          )}
        </section>

        <aside className={styles.card}>
          <h2 className={styles.cardTitle}>Resumen</h2>
          {order ? (
            <div className={styles.totals}>
              <div className={styles.totalRow}><span>Pedido</span><strong>{order.orderNumber}</strong></div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}><span>Total</span><strong>${Number(order.totalPrice || 0).toFixed(2)}</strong></div>
            </div>
          ) : (
            <p className={styles.muted}>No pudimos cargar el pedido.</p>
          )}
          {order && <Link className={styles.secondaryButton} to={`/order/${order.id}`}>Ver seguimiento</Link>}
        </aside>
      </div>
    </Container>
  );
};

export default StripePaymentScreen;
