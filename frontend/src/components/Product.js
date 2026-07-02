import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import Rating from './Rating';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import styles from './Product.module.css';

const Product = ({ product }) => {
  const { addToCart } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const productUrl = `/product/${product.sku || product._id || product.id}`;
  const image = product.image || product.media?.[0]?.url || 'https://placehold.co/400x300/151a1d/75f238?text=TECNOTITLAN';

  const addToCartHandler = (event) => {
    event.preventDefault();
    const item = { product: product.id || product._id, name: product.name, price: product.price, image, qty: 1 };
    addToCart(item);
    showToast(item);
  };

  return (
    <article className={styles.card}>
      <Link to={productUrl} className={styles.imageContainer}><img src={image} alt={product.name} className={styles.productImage} /></Link>
      <div className={styles.cardBody}>
        <span className={styles.category}>{product.sku || 'Selección Tecnotitlán'}</span>
        <Link to={productUrl} className={styles.title}>{product.name}</Link>
        <div className={styles.rating}><Rating value={product.rating || 0} text={`(${product.numReviews || 0})`} color="#75f238" /></div>
        <div className={styles.footer}>
          <span className={styles.price}>${(product.price || 0).toFixed(2)}</span>
          <button className={styles.addButton} onClick={addToCartHandler} disabled={product.countInStock === 0} title="Agregar al carrito"><i className="fas fa-shopping-cart"></i></button>
        </div>
      </div>
    </article>
  );
};

export default Product;
