import React, { useContext, useEffect, useState } from 'react';
import { Button, Card, Col, Container, Form, Image, ListGroup, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import Message from '../components/Message';
import Rating from '../components/Rating';
import { CartContext } from '../context/CartContext';
import { SettingsContext } from '../context/SettingsContext';
import { ToastContext } from '../context/ToastContext';
import api from '../services/apiService';

const fallbackImage = 'https://placehold.co/800x600/151a1d/75f238?text=TECNOTITLAN';

const ProductScreen = () => {
  const { sku } = useParams();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState(null);
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
      } catch (err) {
        setError(err.response?.data?.message || 'Producto no encontrado.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [sku]);

  const image = product?.image || product?.media?.[0]?.url || fallbackImage;

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
    <Container className="py-5" style={{ minHeight: '80vh' }}>
      <Link to="/" className="btn btn-light my-3 rounded-full border-0 shadow-sm">
        <i className="fas fa-chevron-left me-2"></i> Volver a la Tienda
      </Link>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <Row className="g-4">
          <Col md={6}>
            <Image src={image} alt={product.name} fluid className="rounded-xl shadow-lg" />
          </Col>

          <Col md={3}>
            <ListGroup variant="flush" className="rounded-xl border-0 shadow-lg">
              <ListGroup.Item className="bg-white">
                <p className="text-muted small fw-bold mb-2">{product.category?.name || product.sku}</p>
                <h3 className="fw-bold text-dark">{product.name}</h3>
              </ListGroup.Item>

              <ListGroup.Item className="bg-white">
                <Rating value={product.rating || 0} text={`${product.numReviews || 0} reseñas`} />
              </ListGroup.Item>

              <ListGroup.Item className="bg-white">
                <p className="fw-medium text-secondary mb-0">
                  <span className="fw-bold text-dark me-1">Precio:</span>
                  <span className="fs-3 fw-black" style={{ color: 'var(--cta-color)' }}>
                    {currencySymbol}{Number(product.price || 0).toFixed(2)}
                  </span>
                </p>
              </ListGroup.Item>

              <ListGroup.Item className="bg-white">
                <strong className="text-dark">Descripción:</strong>
                <p className="text-secondary mt-1 mb-0">{product.description}</p>
              </ListGroup.Item>
            </ListGroup>
          </Col>

          <Col md={3}>
            <Card className="rounded-xl shadow-lg border-0 mt-4 mt-md-0">
              <ListGroup variant="flush">
                <ListGroup.Item className="bg-white border-b">
                  <Row className="fw-bold">
                    <Col>Precio:</Col>
                    <Col className="text-end" style={{ color: 'var(--cta-color)' }}>
                      {currencySymbol}{Number(product.price || 0).toFixed(2)}
                    </Col>
                  </Row>
                </ListGroup.Item>

                <ListGroup.Item className="bg-white border-b">
                  <Row className="fw-bold">
                    <Col>Estado:</Col>
                    <Col className="text-end">
                      {product.countInStock > 0 ? (
                        <span className="text-success fw-bold">En stock</span>
                      ) : (
                        <span className="text-danger fw-bold">Sin stock</span>
                      )}
                    </Col>
                  </Row>
                </ListGroup.Item>

                {product.countInStock > 0 && (
                  <ListGroup.Item className="bg-white border-b">
                    <Row className="align-items-center">
                      <Col>Cantidad:</Col>
                      <Col xs="auto" className="p-0">
                        <Form.Control
                          as="select"
                          value={qty}
                          onChange={(event) => setQty(Number(event.target.value))}
                          className="rounded-lg shadow-sm text-center"
                          style={{ width: '80px' }}
                        >
                          {[...Array(product.countInStock).keys()].slice(0, 10).map((x) => (
                            <option key={x + 1} value={x + 1}>
                              {x + 1}
                            </option>
                          ))}
                        </Form.Control>
                      </Col>
                    </Row>
                  </ListGroup.Item>
                )}

                <ListGroup.Item className="bg-white">
                  <Button
                    onClick={addToCartHandler}
                    className="btn-primary w-100 rounded-full py-2 shadow-md"
                    type="button"
                    disabled={product.countInStock === 0}
                  >
                    <i className="fas fa-cart-plus me-2"></i> Añadir al carrito
                  </Button>
                </ListGroup.Item>
              </ListGroup>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default ProductScreen;
