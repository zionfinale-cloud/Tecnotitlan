import React from 'react';
import styles from './OrderListScreen.module.css';

const OrderListScreen = () => {
  return (
    <>
      <h1 className={styles.title}>Gestión de Pedidos</h1>
      <p className={styles.subtitle}>Aquí se mostrará la tabla de todos los pedidos y la gestión de estados (pago, envío, entrega).</p>
      <div className={styles.placeholderBox}>
          <p className={styles.placeholderText}>Tabla de pedidos y filtros de estado irán aquí.</p>
      </div>
    </>
  );
};

export default OrderListScreen;
