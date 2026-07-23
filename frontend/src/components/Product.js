import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import Rating from './Rating';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
import styles from './Product.module.css';

const Product = ({ product }) => {
  const { addToCart } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const productUrl = `/product/${product.sku || product._id || product.id}`;
  const image = resolveAssetUrl(product.image || product.media?.[0]?.url);
  const stockCount = Number(product.countInStock || 0);
  const hasStock = stockCount > 0;

  const addToCartHandler = (event) => {
    event.preventDefault();
    if (!hasStock) return;

    const item = {
      product: product.id || product._id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      image,
      qty: 1,
      countInStock: stockCount,
    };

    addToCart(item);
    showToast(item);
  };

  return (
    <article className={`${styles.card} ${!hasStock ? styles.cardOut : ''}`}>
      <Link to={productUrl} className={styles.imageContainer}>
        <img
          src={image}
          alt={product.name}
          className={styles.productImage}
          onError={(event) => {
            event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
          }}
        />
      </Link>
      <div className={styles.cardBody}>
        <span className={styles.category}>{product.sku || 'Seleccion Tecnotitlan'}</span>
        <Link to={productUrl} className={styles.title}>{product.name}</Link>
        <span className={`${styles.stockBadge} ${!hasStock ? styles.stockBadgeOut : ''}`}>
          {hasStock ? `${stockCount} disponible${stockCount === 1 ? '' : 's'}` : 'Agotado temporalmente'}
        </span>
        <div className={styles.rating}>
          <Rating value={product.rating || 0} text={`(${product.numReviews || 0})`} color="#75f238" />
        </div>
        <div className={styles.footer}>
          <span className={styles.price}>${(product.price || 0).toFixed(2)}</span>
          <button
            className={styles.addButton}
            onClick={addToCartHandler}
            disabled={!hasStock}
            title={hasStock ? 'Agregar al carrito' : 'Producto agotado'}
          >
            <i className="fas fa-shopping-cart"></i>
          </button>
        </div>
      </div>
    </article>
  );
};

export default Product;
