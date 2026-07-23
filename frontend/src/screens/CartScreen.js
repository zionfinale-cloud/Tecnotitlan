import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Row, Col, ListGroup, Image, Form, Button, Card, Container } from 'react-bootstrap';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { SettingsContext } from '../context/SettingsContext';
import Message from '../components/Message';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../utils/assetUrl';
import styles from './CartScreen.module.css';

const getItemStock = (item) => {
    const stock = Number(item.countInStock);
    return Number.isFinite(stock) ? stock : null;
};

const CartScreen = () => {
    const navigate = useNavigate();
    const { cartItems, removeFromCart, updateCartItemQty } = useContext(CartContext);
    const { userInfo } = useContext(AuthContext);
    const { settings } = useContext(SettingsContext);
    const currencySymbol = settings.currencySymbol || '$';

    const totalItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
    const totalPrice = cartItems.reduce((acc, item) => acc + item.qty * item.price, 0);
    const stockIssues = cartItems
        .map((item) => ({ item, stock: getItemStock(item) }))
        .filter(({ item, stock }) => stock !== null && (stock <= 0 || item.qty > stock));
    const hasStockIssues = stockIssues.length > 0;

    const checkoutHandler = () => {
        if (hasStockIssues) return;
        navigate(userInfo ? '/shipping' : '/login?redirect=/shipping');
    };

    const qtyChangeHandler = (id, event) => {
        const newQty = Number(event.target.value);
        const item = cartItems.find((cartItem) => cartItem.product === id);
        const stock = item ? getItemStock(item) : null;
        const safeQty = stock !== null && stock > 0 ? Math.min(newQty, stock) : newQty;
        updateCartItemQty(id, safeQty);
    };

    return (
        <Container className={styles.pageContainer}>
            <h1 className={styles.pageTitle}>Carrito de Compras</h1>

            {!userInfo && cartItems.length > 0 && (
                <Message variant="info">
                    Tu carrito se guarda en este navegador. Para completar la compra te pediremos iniciar sesion o crear una cuenta.
                </Message>
            )}

            {hasStockIssues && (
                <Message variant="danger">
                    Hay productos sin stock suficiente. Ajusta cantidades o elimina productos agotados antes de pagar.
                </Message>
            )}

            <Row>
                <Col md={8}>
                    {cartItems.length === 0 ? (
                        <Message variant="info">
                            Tu carrito esta vacio. <Link to="/" className={styles.backLink}>Volver a la tienda</Link>
                        </Message>
                    ) : (
                        <ListGroup variant="flush" className={styles.cartListGroup}>
                            {cartItems.map((item) => {
                                const stock = getItemStock(item);
                                const maxQty = stock !== null && stock > 0 ? Math.min(stock, 10) : 10;
                                const hasItemStockIssue = stock !== null && (stock <= 0 || item.qty > stock);

                                return (
                                    <ListGroup.Item
                                        key={item.product}
                                        className={`${styles.cartItem} ${hasItemStockIssue ? styles.cartItemWarning : ''}`}
                                    >
                                        <Row className="w-100 align-items-center m-0">
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

                                            <Col md={4} className="p-0">
                                                <Link to={`/product/${item.sku || item.product}`} className={styles.productLink}>
                                                    {item.name}
                                                </Link>
                                                {stock !== null && (
                                                    <small className={hasItemStockIssue ? styles.stockIssue : styles.stockNote}>
                                                        {stock > 0
                                                            ? `${stock} disponible${stock === 1 ? '' : 's'}`
                                                            : 'Agotado temporalmente'}
                                                    </small>
                                                )}
                                            </Col>

                                            <Col md={2} className="p-0">
                                                <div className={styles.priceText}>
                                                    {currencySymbol}{Number(item.price || 0).toFixed(2)}
                                                </div>
                                            </Col>

                                            <Col md={2} className="p-0">
                                                <Form.Control
                                                    as="select"
                                                    value={item.qty}
                                                    onChange={(event) => qtyChangeHandler(item.product, event)}
                                                    className={styles.qtySelect}
                                                    disabled={stock !== null && stock <= 0}
                                                >
                                                    {[...Array(maxQty).keys()].map((x) => (
                                                        <option key={x + 1} value={x + 1}>
                                                            {x + 1}
                                                        </option>
                                                    ))}
                                                </Form.Control>
                                            </Col>

                                            <Col md={2} className="p-0 d-flex justify-content-end">
                                                <Button
                                                    type="button"
                                                    variant="light"
                                                    onClick={() => removeFromCart(item.product)}
                                                    className={styles.deleteButton}
                                                >
                                                    <i className={`fas fa-trash ${styles.trashIcon}`}></i>
                                                </Button>
                                            </Col>
                                        </Row>
                                    </ListGroup.Item>
                                );
                            })}
                        </ListGroup>
                    )}
                </Col>

                <Col md={4}>
                    <Card className={styles.summaryCard}>
                        <ListGroup variant="flush">
                            <ListGroup.Item className="bg-transparent p-4 border-bottom">
                                <h2 className={styles.summaryHeader}>
                                    Subtotal ({totalItems}) articulos
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
                                    type="button"
                                    className={`btn btn-primary ${styles.checkoutButton}`}
                                    disabled={cartItems.length === 0 || hasStockIssues}
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
