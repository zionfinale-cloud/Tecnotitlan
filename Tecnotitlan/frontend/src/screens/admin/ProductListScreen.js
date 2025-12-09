import React from 'react';
import styles from './ProductListScreen.module.css';

const ProductListScreen = () => {
  return (
    <>
      <h1 className={styles.title}>Gestión de Productos</h1>
      <p className={styles.subtitle}>Aquí se mostrará la tabla de todos los productos y las opciones de creación/edición.</p>
      <div className={styles.placeholderBox}>
          <p className={styles.placeholderText}>Tabla de productos y filtros irán aquí.</p>
      </div>
    </>
  );
};

export default ProductListScreen;