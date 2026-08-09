import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Container } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import Message from '../components/Message';
import Rating from '../components/Rating';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { SettingsContext } from '../context/SettingsContext';
import { ToastContext } from '../context/ToastContext';
import api from '../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
import { getAvailabilityText, getItemAvailableStock, hasItemAvailability } from '../utils/productAvailability';
import styles from './ProductScreen.module.css';

const fallbackImage = FALLBACK_PRODUCT_IMAGE;

const isInternalCharacteristic = (characteristic) =>
  /^\s*(?:etiquetas?\s*tecatl|tecatl\s*tags?)\s*$/i.test(characteristic?.key || '');

const getEmbeddedVideo = (url) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (hostname === 'youtu.be') {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      return videoId ? { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0` } : null;
    }

    if (hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      return videoId ? { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0` } : null;
    }

    if (hostname.includes('tiktok.com')) {
      const videoId = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
      return videoId ? { type: 'iframe', src: `https://www.tiktok.com/embed/v2/${videoId}` } : null;
    }

    if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(parsed.pathname)) {
      return { type: 'video', src: parsed.toString() };
    }
  } catch (error) {
    return null;
  }

  return null;
};

const ProductScreen = () => {
  const { sku } = useParams();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');

  const { userInfo } = useContext(AuthContext);
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
        const nextProduct = data.data.product;
        setProduct(nextProduct);
        setActiveImage(resolveAssetUrl(nextProduct?.media?.[0]?.url, ''));
        setShowVideo(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Producto no encontrado.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [sku]);

  const image = activeImage || resolveAssetUrl(product?.image || product?.media?.[0]?.url);
  const isFallbackImage = image === fallbackImage;
  const visibleCharacteristics = useMemo(
    () => (product?.characteristics || []).filter((item) => !isInternalCharacteristic(item)),
    [product]
  );
  const embeddedVideo = useMemo(() => getEmbeddedVideo(product?.youtubeUrl), [product?.youtubeUrl]);
  const availableStock = getItemAvailableStock(product);
  const hasStock = hasItemAvailability(product);
  const maxQuantity = availableStock === null ? 10 : Math.min(availableStock, 10);
  const reviews = product?.reviews || [];
  const userHasReviewed = Boolean(
    userInfo?.id && reviews.some((review) => review.userId === userInfo.id)
  );

  const addToCartHandler = () => {
    if (!product || !hasStock) return;

    const itemToAdd = {
      product: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      image,
      qty,
      countInStock: product.countInStock,
      availableStock: product.availableStock,
      availabilityMode: product.availabilityMode,
      productType: product.productType,
      supplierStock: product.supplierStock,
      supplierStockUnlimited: product.supplierStockUnlimited,
      supplierLeadTimeMinutes: product.supplierLeadTimeMinutes,
    };

    addToCart(itemToAdd);
    showToast(itemToAdd);
  };

  const selectImage = (url) => {
    setShowVideo(false);
    setActiveImage(resolveAssetUrl(url));
  };

  const submitReviewHandler = async (event) => {
    event.preventDefault();
    setReviewMessage('');
    setReviewError('');
    setReviewSubmitting(true);

    try {
      await api.post(`/products/${sku}/reviews`, {
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
      });
      const { data } = await api.get(`/products/${sku}`);
      setProduct(data.data.product);
      setReviewRating(5);
      setReviewComment('');
      setReviewMessage('Gracias. Tu opinion ya aparece en el producto.');
    } catch (err) {
      setReviewError(err.response?.data?.message || 'No pudimos guardar tu opinion.');
    } finally {
      setReviewSubmitting(false);
    }
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
        <div className={styles.productLayout}>
          <section className={styles.gallery} aria-label="Galeria del producto">
            <div className={styles.galleryStage}>
              {showVideo && embeddedVideo ? (
                embeddedVideo.type === 'video' ? (
                  <video className={styles.videoPlayer} controls autoPlay playsInline src={embeddedVideo.src} />
                ) : (
                  <iframe
                    className={styles.videoFrame}
                    src={embeddedVideo.src}
                    title={`Video de ${product.name}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )
              ) : isFallbackImage ? (
                <div className={styles.placeholderText}>TECNOTITLAN</div>
              ) : (
                <img
                  src={image}
                  alt={product.name}
                  className={styles.productImage}
                  onError={(event) => {
                    event.currentTarget.src = fallbackImage;
                  }}
                />
              )}
            </div>

            {(product.media?.length > 1 || embeddedVideo) && (
              <div className={styles.thumbRow}>
                {product.media?.map((item, index) => {
                  const itemUrl = resolveAssetUrl(item.url);
                  return (
                    <button
                      aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                      className={`${styles.thumbButton} ${!showVideo && itemUrl === image ? styles.thumbActive : ''}`}
                      key={item.id || item.url}
                      type="button"
                      onClick={() => selectImage(item.url)}
                    >
                      <img src={itemUrl} alt={item.altText || `${product.name} ${index + 1}`} />
                    </button>
                  );
                })}
                {embeddedVideo && (
                  <button
                    aria-label={`Reproducir video de ${product.name}`}
                    className={`${styles.thumbButton} ${styles.videoThumb} ${showVideo ? styles.thumbActive : ''}`}
                    type="button"
                    onClick={() => setShowVideo(true)}
                  >
                    <i className="fas fa-play"></i>
                    <span>Video</span>
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className={styles.purchaseColumn}>
            <article className={styles.summaryPanel}>
              <span className={styles.category}>{product.category?.name || product.sku}</span>
              <h1 className={styles.title}>{product.name}</h1>
              {product.shortDescription && (
                <p className={styles.shortDescription}>{product.shortDescription}</p>
              )}
              <div className={styles.ratingRow}>
                <Rating value={product.rating || 0} text={`${product.numReviews || 0} resenas`} color="var(--cta-color)" />
              </div>
            </article>

            <aside className={styles.buyBox}>
              <div className={styles.buyRow}>
                <span>Precio</span>
                <strong className={styles.price}>{currencySymbol}{Number(product.price || 0).toFixed(2)}</strong>
              </div>
              <div className={styles.buyRow}>
                <span>Estado</span>
                {hasStock ? (
                  <strong className={styles.stockOk}>
                    {getAvailabilityText(product)}
                    {availableStock !== null && availableStock <= 3 && <small className={styles.stockHint}>Quedan pocas piezas</small>}
                  </strong>
                ) : (
                  <strong className={styles.stockOut}>Agotado temporalmente</strong>
                )}
              </div>

              {hasStock && (
                <div className={styles.buyRow}>
                  <span>Cantidad</span>
                  <select className={styles.select} value={qty} onChange={(event) => setQty(Number(event.target.value))}>
                    {[...Array(maxQuantity).keys()].map((value) => (
                      <option key={value + 1} value={value + 1}>{value + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              <button className={styles.cartButton} onClick={addToCartHandler} type="button" disabled={!hasStock}>
                <i className="fas fa-cart-plus me-2"></i> {hasStock ? 'Anadir al carrito' : 'Sin stock por el momento'}
              </button>
            </aside>

            <div className={styles.benefitBox}>
              <div className={styles.benefit}><i className="fas fa-truck"></i> Envios a todo Mexico</div>
              <div className={styles.benefit}><i className="fas fa-shield-alt"></i> Compra segura</div>
              <div className={styles.benefit}><i className="fas fa-medal"></i> Garantia y respaldo</div>
              <div className={styles.benefit}><i className="fas fa-headset"></i> Atencion personalizada</div>
            </div>
          </aside>

          <section className={styles.details}>
            {product.description && (
              <article className={styles.detailsPanel}>
                <h2>Descripcion</h2>
                <p className={styles.description}>{product.description}</p>
              </article>
            )}

            {visibleCharacteristics.length > 0 && (
              <article className={styles.detailsPanel}>
                <h2>Especificaciones</h2>
                <dl className={styles.specList}>
                  {visibleCharacteristics.map((item) => (
                    <div key={item.id || `${item.key}-${item.value}`}>
                      <dt>{item.key}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            )}

            <article className={styles.detailsPanel}>
              <div className={styles.reviewHeading}>
                <div>
                  <h2>Opiniones de clientes</h2>
                  <p>Experiencias reales de quienes ya compraron este producto.</p>
                </div>
                <Rating
                  value={product.rating || 0}
                  text={`${product.numReviews || 0} resenas`}
                  color="var(--cta-color)"
                />
              </div>

              {reviews.length > 0 ? (
                <div className={styles.reviewList}>
                  {reviews.map((review) => {
                    const reviewerName = review.name
                      || [review.user?.firstName, review.user?.lastName].filter(Boolean).join(' ')
                      || 'Cliente Tecnotitlan';
                    const reviewDate = review.createdAt
                      ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(review.createdAt))
                      : '';

                    return (
                      <div className={styles.reviewCard} key={review.id}>
                        <div className={styles.reviewCardHeader}>
                          <strong>{reviewerName}</strong>
                          <Rating value={review.rating} color="var(--cta-color)" />
                        </div>
                        <p className={styles.reviewComment}>{review.comment}</p>
                        {reviewDate && <span className={styles.reviewMeta}>{reviewDate}</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.emptyReviews}>Aun no hay opiniones. Se el primero en compartir tu experiencia.</p>
              )}

              {userInfo ? (
                userHasReviewed ? (
                  <p className={styles.reviewFeedback}>Ya compartiste una opinion sobre este producto.</p>
                ) : (
                  <form className={styles.reviewForm} onSubmit={submitReviewHandler}>
                    <h3>Califica tu compra</h3>
                    <div className={styles.reviewFields}>
                      <label className={styles.reviewField}>
                        Calificacion
                        <select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>
                          <option value="5">5 - Excelente</option>
                          <option value="4">4 - Muy bueno</option>
                          <option value="3">3 - Bueno</option>
                          <option value="2">2 - Regular</option>
                          <option value="1">1 - Malo</option>
                        </select>
                      </label>
                      <label className={styles.reviewField}>
                        Tu opinion
                        <textarea
                          className={styles.reviewTextarea}
                          value={reviewComment}
                          onChange={(event) => setReviewComment(event.target.value)}
                          minLength="3"
                          maxLength="1000"
                          placeholder="Cuentanos como te fue con el producto"
                          required
                        />
                      </label>
                    </div>
                    {reviewError && <p className={`${styles.reviewFeedback} ${styles.reviewError}`}>{reviewError}</p>}
                    {reviewMessage && <p className={styles.reviewFeedback}>{reviewMessage}</p>}
                    <button className={styles.reviewSubmit} type="submit" disabled={reviewSubmitting}>
                      {reviewSubmitting ? 'Publicando...' : 'Publicar opinion'}
                    </button>
                  </form>
                )
              ) : (
                <p className={styles.reviewLogin}>
                  <Link to="/login">Inicia sesion</Link> para calificar este producto.
                </p>
              )}
            </article>
          </section>
        </div>
      )}
    </Container>
  );
};

export default ProductScreen;
