import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import styles from './LoginScreen.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { userInfo, login, loading } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);

    const searchParams = new URLSearchParams(location.search);
    const redirect = location.state?.from?.pathname || searchParams.get('redirect') || '/';

    useEffect(() => {
        if (userInfo) {
            navigate(redirect);
        }
    }, [navigate, userInfo, redirect]);

    const submitHandler = async (event) => {
        event.preventDefault();

        try {
            await login(email, password);
        } catch (error) {
            showNotification(error.response?.data?.message || 'No pudimos iniciar sesion. Revisa tu correo y contrasena.', 'danger');
        }
    };

    return (
        <div className={`${styles.pageContainer} d-flex justify-content-center align-items-center`} style={{ minHeight: '80vh' }}>
            <Card className={styles.loginCard}>
                <Card.Body>
                    <h1 className={styles.title}>Iniciar Sesion</h1>

                    {loading && <LoadingSpinner />}

                    <Form onSubmit={submitHandler}>
                        <Form.Group controlId="email" className="mb-3">
                            <Form.Label className={styles.label}>Correo electronico</Form.Label>
                            <Form.Control
                                type="email"
                                placeholder="Introduce tu email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className={styles.input}
                                autoComplete="email"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                inputMode="email"
                                required
                            />
                        </Form.Group>

                        <Form.Group controlId="password" className="mb-4">
                            <Form.Label className={styles.label}>Contrasena</Form.Label>
                            <div className={styles.passwordField}>
                                <Form.Control
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Introduce tu contrasena"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className={styles.input}
                                    autoComplete="current-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowPassword((value) => !value)}
                                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                                >
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </Form.Group>

                        <Button
                            type="submit"
                            variant="primary"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </Form>

                    <div className={styles.linkRow}>
                        Nuevo cliente?{' '}
                        <Link to={redirect ? `/register?redirect=${redirect}` : '/register'} className={styles.registerLink}>
                            Registrate
                        </Link>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default LoginScreen;
