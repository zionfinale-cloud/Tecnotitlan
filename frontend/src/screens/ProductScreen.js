import React, { useContext, useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import Message from '../components/Message';
import Rating from '../components/Rating';
import { CartContext } from '../context/CartContext';
import { SettingsContext } from '../context/SettingsContext';
import { ToastContext } from '../context/ToastContext';
import api from '../services/apiService';
import styles from './ProductScreen.module.css';

const fallbackImage = 'https://placehold.co/900x700/151a1d/75f238?text=TECNOTITLAN';

const ProductScreen = () => {
  const { sku } = useParams();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { addToCart } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const { settings } = useContext(SettingsContext);
  const currencySymbol = settings.currencySymbol || '$';

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await api.get(`/products/${sku}`);
        setProduct(data.data.product);
        setActiveImage(data.data.product?.media?.[0]?.url || '');
      } catch (err) {
        setError(err.response?.data?.message || 'Producto no encontrado.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [sku]);

  const image = activeImage || product?.image || product?.media?.[0]?.url || fallbackImage;
  const isFallbackImage = image === fallbackImage;
  const characteristics = product?.characteristics || [];

  const addToCartHandler = () => {
    if (!product) return;

    const itemToAdd = {
      product: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      image,
      qty,
    };

    addToCart(itemToAdd);
    showToast(itemToAdd);
  };

  return (
    <Container className={styles.page}>
      <Link to="/" className={styles.backLink}>
        <i className="fas fa-chevron-left"></i> Volver a la tienda
      </Link>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <div className={styles.grid}>
          <section className={styles.gallery}>
            {isFallbackImage ? (
              <div className={styles.placeholderText}>TECNOTITLAN</div>
            ) : (
              <img src={image} alt={product.name} className={styles.productImage} />
            )}
            {product.media?.length > 1 && (
              <div className={styles.thumbRow}>
                {product.media.map((item) => (
                  <button
                    className={`${styles.thumbButton} ${item.url === image ? styles.thumbActive : ''}`}
                    key={item.id || item.url}
                    type="button"
                    onClick={() => setActiveImage(item.url)}
                  >
                    <img src={item.url} alt={item.altText || product.name} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={styles.infoStack}>
            <article className={styles.panel}>
              <span className={styles.category}>{product.category?.name || product.sku}</span>
              <h1 className={styles.title}>{product.name}</h1>

              <div className={styles.ratingRow}>
                <Rating value={product.rating || 0} text={`${product.numReviews || 0} reseñas`} color="var(--cta-color)" />
              </div>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Precio</span>
                <span className={styles.price}>{currencySymbol}{Number(product.price || 0).toFixed(2)}</span>
              </div>

              <div>
                <div className={styles.descriptionTitle}>Descripcion</div>
                <p className={styles.description}>{product.description}</p>
              </div>

              {characteristics.length > 0 && (
                <div>
                  <div className={styles.descriptionTitle}>Especificaciones</div>
                  <div className={styles.specGrid}>
                    {characteristics.map((item) => (
                      <div className={styles.specItem} key={item.id || `${item.key}-${item.value}`}>
                        <span>{item.key}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.youtubeUrl && (
                <a className={styles.videoLink} href={product.youtubeUrl} target="_blank" rel="noreferrer">
                  <i className="fas fa-play-circle"></i> Ver video del producto
                </a>
              )}
            </article>

            <aside className={styles.buyBox}>
              <div className={styles.buyRow}>
                <span>Precio</span>
                <strong className={styles.price}>{currencySymbol}{Number(product.price || 0).toFixed(2)}</strong>
              </div>
              <div className={styles.buyRow}>
                <span>Estado</span>
                {product.countInStock > 0 ? (
                  <strong className={styles.stockOk}>En stock</strong>
                ) : (
                  <strong className={styles.stockOut}>Sin stock</strong>
                )}
              </div>

              {product.countInStock > 0 && (
                <div className={styles.buyRow}>
                  <span>Cantidad</span>
                  <select className={styles.select} value={qty} onChange={(event) => setQty(Number(event.target.value))}>
                    {[...Array(product.countInStock).keys()].slice(0, 10).map((x) => (
                      <option key={x + 1} value={x + 1}>
                        {x + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button className={styles.cartButton} onClick={addToCartHandler} type="button" disabled={product.countInStock === 0}>
                <i className="fas fa-cart-plus me-2"></i> Añadir al carrito
              </button>
            </aside>

            <div className={styles.benefitBox}>
              <div className={styles.benefit}><i className="fas fa-truck"></i> Envíos a todo México</div>
              <div className={styles.benefit}><i className="fas fa-shield-alt"></i> Compra segura</div>
              <div className={styles.benefit}><i className="fas fa-medal"></i> Garantía y respaldo</div>
              <div className={styles.benefit}><i className="fas fa-headset"></i> Atención personalizada</div>
            </div>
          </section>
        </div>
      )}
    </Container>
  );
};

export default ProductScreen;
