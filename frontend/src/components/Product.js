import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
// Importamos componentes necesarios
import Rating from './Rating'; 
import { CartContext } from '../context/CartContext'; 
import { ToastContext } from '../context/ToastContext';
// Importamos el CSS Module Puro (que tienes abierto en el Canvas)
import styles from './Product.module.css';

const Product = ({ product }) => {
  const { addToCart } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);

  // Manejador para añadir al carrito
  const addToCartHandler = (e) => {
    e.preventDefault(); // Evitar navegación al hacer clic en el botón
    
    const itemToAdd = {
      product: product.id || product._id, 
      name: product.name,
      price: product.price,
      image: product.image || product.media?.[0]?.url, 
      qty: 1, 
    };
    
    addToCart(itemToAdd);
    showToast(itemToAdd); 
  };

  return (
    // Usamos styles.card en lugar del Card de Bootstrap para tener control total del diseño
    <div className={styles.card}>
      
      {/* 1. Imagen Flotante */}
      <Link to={`/product/${product._id || product.sku}`} className={styles.imageContainer}>
        <img 
            src={product.image || 'https://via.placeholder.com/300'} 
            alt={product.name} 
            className={styles.productImage} 
        />
      </Link>

      {/* 2. Cuerpo de la Tarjeta */}
      <div className={styles.cardBody}>
        {/* Categoría (Opcional, estático o dinámico) */}
        <span className={styles.category}>
            {product.productType === 'IN_HOUSE' ? 'Tecnotitlán' : 'Marketplace'}
        </span>

        {/* Título */}
        <Link to={`/product/${product._id || product.sku}`} className={styles.title}>
          {product.name}
        </Link>

        {/* Rating */}
        <div className={styles.rating}>
           <Rating 
             value={product.rating} 
             text={`${product.numReviews} reseñas`} 
             color={'#fbbf24'} // Amber 400
           />
        </div>

        {/* 3. Footer: Precio y Botón Circular */}
        <div className={styles.footer}>
          <span className={styles.price}>
            ${(product.price || 0).toFixed(2)}
          </span>
          
          <button 
            className={styles.addButton} 
            onClick={addToCartHandler}
            disabled={product.countInStock === 0}
            title="Agregar al carrito"
          >
            <i className="fas fa-shopping-cart"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Product;