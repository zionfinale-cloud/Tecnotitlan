import React, { useState, useContext, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Image, ListGroup, Card, Button, Form, Container } from 'react-bootstrap';
// Importamos dependencias
import Rating from '../components/Rating';
import LoadingSpinner from '../components/LoadingSpinner';
import Message from '../components/Message';
// Contextos
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import { SettingsContext } from '../context/SettingsContext';

// --- MOCK DATA para simular la carga ---
const MOCK_PRODUCT_DETAILS = {
  DRN001: { _id: '1', sku: 'DRN001', name: 'Deona Pexnnices (Smartwatch)', description: 'El Smartwatch Deona Pexnnices es la fusión perfecta de estilo prehispánico y funcionalidad moderna. Construido con titanio pulido inspirado en la obsidiana, ofrece monitoreo de salud avanzado y una batería solar de larga duración.', price: 199.99, rating: 4.5, numReviews: 12, countInStock: 5, image: 'https://placehold.co/800x600/F1F5F9/0F172A?text=SMARTWATCH+DETAIL' },
  VR001: { _id: '2', sku: 'VR001', name: 'Trps del Tib (VR Headset)', description: 'Sumérgete en la Realidad Virtual con la fidelidad del Trps del Tib. Lentes ópticas de grado militar y sonido espacial 3D para una inmersión total en el Metaverso Azteca.', price: 299.99, rating: 5, numReviews: 25, countInStock: 10, isOffer: true, image: 'https://placehold.co/800x600/F1F5F9/0F172A?text=VR+HEADSET+DETAIL' },
};
// --- FIN MOCK DATA ---

const ProductScreen = () => {
  const { sku } = useParams();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState(null); // Producto cargado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { addToCart } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const { settings } = useContext(SettingsContext);
  const currencySymbol = settings.currencySymbol || '$';

  // Simulación de carga de producto
  useEffect(() => {
    setLoading(true);
    // Simular llamada a la API por SKU
    setTimeout(() => {
      const foundProduct = MOCK_PRODUCT_DETAILS[sku];
      if (foundProduct) {
        setProduct(foundProduct);
        setError(null);
      } else {
        setError('Producto no encontrado.');
      }
      setLoading(false);
    }, 500);
  }, [sku]);

  const addToCartHandler = () => {
    if (product) {
      const itemToAdd = {
        product: product._id, // Usamos el ID de la base de datos
        sku: product.sku,
        name: product.name,
        price: product.price,
        image: product.image,
        qty: qty, 
      };
      
      addToCart(itemToAdd);
      showToast(itemToAdd);
    }
  };

  return (
    <Container className="py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
      {/* Botón de Regresar */}
      <Link to='/' className='btn btn-light my-3 rounded-full border-0 shadow-sm'>
        <i className="fas fa-chevron-left me-2"></i> Volver a la Tienda
      </Link>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <Row>
          {/* Columna 1: Imagen Principal */}
          <Col md={6}>
            <Image src={product.image} alt={product.name} fluid className="rounded-xl shadow-lg border border-gray-100" />
          </Col>

          {/* Columna 2: Detalles del Producto */}
          <Col md={3}>
            <ListGroup variant='flush' className="rounded-xl border-0 shadow-lg">
              <ListGroup.Item className="bg-white rounded-t-xl">
                <h3 className="font-bold text-2xl text-slate-800">{product.name}</h3>
              </ListGroup.Item>

              <ListGroup.Item className="bg-white">
                <Rating value={product.rating} text={`${product.numReviews} reseñas`} />
              </ListGroup.Item>

              <ListGroup.Item className="bg-white">
                <p className="font-medium text-slate-600 mb-0">
                  <span className="font-bold text-slate-800 me-1">Precio:</span> 
                  <span className="text-2xl font-extrabold" style={{ color: 'var(--cta-color)' }}>{currencySymbol}{product.price}</span>
                </p>
              </ListGroup.Item>
              
              <ListGroup.Item className="bg-white rounded-b-xl">
                <strong className="text-slate-800">Descripción:</strong> 
                <p className="text-slate-600 mt-1">{product.description}</p>
              </ListGroup.Item>
            </ListGroup>
          </Col>

          {/* Columna 3: Tarjeta de Compra */}
          <Col md={3}>
            <Card className="rounded-xl shadow-lg border-0 mt-4 mt-md-0">
              <ListGroup variant='flush'>
                
                {/* Estado y Precio */}
                <ListGroup.Item className="bg-white border-b">
                  <Row className="fw-bold">
                    <Col>Precio:</Col>
                    <Col className="text-end text-lg" style={{ color: 'var(--cta-color)' }}>{currencySymbol}{product.price}</Col>
                  </Row>
                </ListGroup.Item>
                
                <ListGroup.Item className="bg-white border-b">
                  <Row className="fw-bold">
                    <Col>Estado:</Col>
                    <Col className="text-end">
                      {product.countInStock > 0 ? (
                        <span className="text-success fw-bold">En Stock</span>
                      ) : (
                        <span className="text-danger fw-bold">Sin Stock</span>
                      )}
                    </Col>
                  </Row>
                </ListGroup.Item>

                {/* Selector de Cantidad */}
                {product.countInStock > 0 && (
                  <ListGroup.Item className="bg-white border-b">
                    <Row className="align-items-center">
                      <Col>Cantidad:</Col>
                      <Col xs='auto' className='p-0'>
                        <Form.Control
                            as='select'
                            value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                            className="rounded-lg shadow-sm text-center"
                            style={{ width: '80px' }}
                        >
                            {/* Generar opciones hasta el stock disponible (max 10) */}
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

                {/* Botón Añadir al Carrito */}
                <ListGroup.Item className="bg-white">
                  <Button
                    onClick={addToCartHandler}
                    className='btn-primary w-full rounded-full py-2 shadow-md'
                    type='button'
                    disabled={product.countInStock === 0}
                  >
                    <i className="fas fa-cart-plus me-2"></i> Añadir al Carrito
                  </Button>
                </ListGroup.Item>
              </ListGroup>
            </Card>
          </Col>
        </Row>
      )}
      
      {/* Sección de Reseñas (PENDIENTE DE IMPLEMENTAR) */}
      <Row className="mt-5">
        {/* Aquí irían las reseñas */}
      </Row>
    </Container>
  );
};

export default ProductScreen;