import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { getPaymentMethod, savePaymentMethod } from '../utils/checkoutStorage';
import { stripePublishableKey } from '../utils/runtimeEnv';
import styles from './Checkout.module.css';

const stripeConfigured = Boolean(stripePublishableKey);

const manualPaymentMethods = [
  {
    id: 'BANK_TRANSFER',
    title: 'Transferencia bancaria / SPEI',
    description: 'Registramos tu pedido y te compartimos los datos para confirmar el pago.',
  },
  {
    id: 'MERCADO_LIBRE',
    title: 'Pago por Mercado Libre',
    description: 'Te damos seguimiento para pagarlo por Mercado Libre cuando convenga usar esa proteccion.',
  },
  {
    id: 'WHATSAPP',
    title: 'Confirmar por WhatsApp',
    description: 'Ideal si quieres resolver dudas antes de pagar o coordinar una compra especial.',
  },
];

const paymentMethods = [
  ...(stripeConfigured ? [{
    id: 'Stripe',
    title: 'Tarjeta de credito/debito',
    description: 'Pago seguro procesado por Stripe. Tecnotitlan no guarda los datos de tu tarjeta.',
  }] : []),
  ...manualPaymentMethods,
];

const futureMethods = stripeConfigured ? [] : [
  {
    id: 'Stripe',
    title: 'Tarjeta con Stripe',
    description: 'Integracion preparada en el sistema. Se activara cuando quede lista la cuenta fiscal.',
  },
];

const PaymentScreen = () => {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState(getPaymentMethod());

  const submitHandler = (event) => {
    event.preventDefault();
    savePaymentMethod(selectedMethod);
    navigate('/placeorder');
  };

  return (
    <Container className={styles.page}>
      <h1 className={styles.title}>Metodo de pago</h1>
      <p className={styles.subtitle}>Por ahora operaremos pagos manuales para salir rapido y sin meter friccion fiscal.</p>

      <form className={styles.grid} onSubmit={submitHandler}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Elige como quieres pagar</h2>
          <div className={styles.methods}>
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`${styles.method} ${selectedMethod === method.id ? styles.methodActive : ''}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={selectedMethod === method.id}
                  onChange={(event) => setSelectedMethod(event.target.value)}
                />
                <span>
                  <strong>{method.title}</strong>
                  <small>{method.description}</small>
                </span>
              </label>
            ))}
          </div>

          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/shipping">Volver a envio</Link>
            <button className={styles.primaryButton} type="submit">Revisar pedido</button>
          </div>
        </section>

        <aside className={styles.card}>
          <h2 className={styles.cardTitle}>Preparado para crecer</h2>
          {futureMethods.map((method) => (
            <div key={method.id} className={`${styles.method} ${styles.methodDisabled}`}>
              <i className="fas fa-lock" aria-hidden="true" />
              <span>
                <strong>{method.title}</strong>
                <small>{method.description}</small>
              </span>
            </div>
          ))}
          <div className={styles.instructions}>
            <h3>{stripeConfigured ? 'Stripe activo' : 'Stripe queda implementado'}</h3>
            <p>{stripeConfigured ? 'Tus clientes ya pueden elegir pago con tarjeta.' : 'El backend ya puede crear Payment Intents. Falta configurar la publishable key en el frontend.'}</p>
          </div>
        </aside>
      </form>
    </Container>
  );
};

export default PaymentScreen;
