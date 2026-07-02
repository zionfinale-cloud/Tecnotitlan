import React from 'react';
import Product from './Product';
import Paginate from './Paginate';
import styles from './ProductList.module.css';

const ProductList = ({ products, loading, error, pages, page, setPage }) => (
  <>
    {loading ? (
      <div className={styles.emptyContainer}><i className="fas fa-circle-notch fa-spin"></i><h4>Cargando catálogo...</h4></div>
    ) : error ? (
      <div className={styles.emptyContainer}><i className="fas fa-plug"></i><h4>{error}</h4></div>
    ) : (!products || products.length === 0) ? (
      <div className={styles.emptyContainer}><i className="fas fa-box-open"></i><h4>No hay productos en esta sección.</h4></div>
    ) : (
      <>
        <div className={styles.grid}>{products.map((product) => <Product key={product.id || product._id || product.sku} product={product} />)}</div>
        {pages > 1 && <div className={styles.pagination}><Paginate pages={pages} page={page} setPage={setPage} /></div>}
      </>
    )}
  </>
);

export default ProductList;
