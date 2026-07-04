import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Row, Col, ListGroup, Image, Form, Button, Card, Container } from 'react-bootstrap';
// Contextos necesarios
import { CartContext } from '../context/CartContext';
import { SettingsContext } from '../context/SettingsContext';
// Componentes de feedback
import Message from '../components/Message'; 
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
// Estilos CSS Modules (Puro CSS)
import styles from './CartScreen.module.css';

const CartScreen = () => {
    const navigate = useNavigate();
    const { cartItems, removeFromCart, updateCartItemQty } = useContext(CartContext);
    const { settings } = useContext(SettingsContext);
    const currencySymbol = settings.currencySymbol || '$';

    // Sumar el total de artículos y el precio total
    const totalItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
    const totalPrice = cartItems.reduce((acc, item) => acc + item.qty * item.price, 0);

    const checkoutHandler = () => {
        // Redirige al login. Si ya está logueado, ProtectedRoute lo enviará a /shipping.
        navigate('/login?redirect=/shipping');
    };
    
    // Función para cambiar la cantidad en el carrito
    const qtyChangeHandler = (id, e) => {
        const newQty = Number(e.target.value);
        updateCartItemQty(id, newQty);
    };

    return (
        <Container className={styles.pageContainer}>
            <h1 className={styles.pageTitle}>Carrito de Compras</h1>
            
            <Row>
                <Col md={8}>
                    {cartItems.length === 0 ? (
                        // Mensaje si el carrito está vacío
                        <Message variant='info'>
                            Tu carrito está vacío. <Link to='/' className={styles.backLink}>Volver a la tienda</Link>
                        </Message>
                    ) : (
                        // Lista de Artículos
                        <ListGroup variant='flush' className={styles.cartListGroup}>
                            {cartItems.map((item) => (
                                <ListGroup.Item 
                                    key={item.product} 
                                    className={styles.cartItem}
                                >
                                    <Row className="w-100 align-items-center m-0">
                                        {/* Imagen del Producto */}
                                        <Col md={2} className="p-0">
                                            <Image 
                                                src={resolveAssetUrl(item.image)} 
                                                alt={item.name} 
                                                fluid 
                                                className={styles.productImage} 
                                                onError={(event) => {
                                                    event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                                                }}
                                            />
                                        </Col>
                                        
                                        {/* Nombre/Link */}
                                        <Col md={4} className="p-0">
                                            <Link 
                                                to={`/product/${item.sku || item.product}`} 
                                                className={styles.productLink}
                                            >
                                                {item.name}
                                            </Link>
                                        </Col>

                                        {/* Precio */}
                                        <Col md={2} className="p-0">
                                            <div className={styles.priceText}>
                                                {currencySymbol}{(item.price).toFixed(2)}
                                            </div>
                                        </Col>

                                        {/* Selector de Cantidad */}
                                        <Col md={2} className="p-0">
                                            <Form.Control
                                                as='select'
                                                value={item.qty}
                                                onChange={(e) => qtyChangeHandler(item.product, e)}
                                                className={styles.qtySelect}
                                            >
                                                {/* Generar opciones hasta 10 (o hasta el stock real) */}
                                                {[...Array(10).keys()].map((x) => (
                                                    <option key={x + 1} value={x + 1}>
                                                        {x + 1}
                                                    </option>
                                                ))}
                                            </Form.Control>
                                        </Col>

                                        {/* Botón de Eliminar */}
                                        <Col md={2} className="p-0 d-flex justify-content-end">
                                            <Button
                                                type='button'
                                                variant='light'
                                                onClick={() => removeFromCart(item.product)}
                                                className={styles.deleteButton}
                                            >
                                                <i className={`fas fa-trash ${styles.trashIcon}`}></i>
                                            </Button>
                                        </Col>
                                    </Row>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </Col>

                {/* Resumen del Pedido (Sidebar) */}
                <Col md={4}>
                    <Card className={styles.summaryCard}>
                        <ListGroup variant='flush'>
                            <ListGroup.Item className="bg-transparent p-4 border-bottom">
                                <h2 className={styles.summaryHeader}>
                                    Subtotal ({totalItems}) artículos
                                </h2>
                            </ListGroup.Item>

                            <ListGroup.Item className="bg-transparent p-4">
                                <Row>
                                    <Col className="fw-medium" style={{ fontSize: '1.1rem' }}>Total estimado:</Col>
                                    <Col className={styles.summaryTotal}>
                                        {currencySymbol}{totalPrice.toFixed(2)}
                                    </Col>
                                </Row>
                            </ListGroup.Item>

                            <ListGroup.Item className="bg-transparent p-4 pt-0">
                                <Button
                                    type='button'
                                    // Combinamos la clase base de bootstrap (btn-primary) con nuestra clase de estilo (checkoutButton)
                                    className={`btn btn-primary ${styles.checkoutButton}`}
                                    disabled={cartItems.length === 0}
                                    onClick={checkoutHandler}
                                >
                                    Proceder al Pago
                                </Button>
                            </ListGroup.Item>
                        </ListGroup>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default CartScreen;
