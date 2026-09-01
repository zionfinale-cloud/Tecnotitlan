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
    const [challengeToken, setChallengeToken] = useState('');
    const [securityCode, setSecurityCode] = useState('');

    const navigate = useNavigate();
    const location = useLocation();
    const { userInfo, login, completeTwoFactorLogin, loading } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);

    const searchParams = new URLSearchParams(location.search);
    const redirect = location.state?.from?.pathname || searchParams.get('redirect') || '/';

    useEffect(() => {
        if (userInfo) {
            navigate(userInfo.requiresTwoFactorSetup && !userInfo.twoFactorEnabled ? '/admin/security' : redirect);
        }
    }, [navigate, userInfo, redirect]);

    const submitHandler = async (event) => {
        event.preventDefault();

        try {
            const result = challengeToken
                ? await completeTwoFactorLogin(challengeToken, securityCode)
                : await login(email, password);
            if (result?.twoFactorRequired) {
                setChallengeToken(result.challengeToken);
                setSecurityCode('');
            }
        } catch (error) {
            showNotification(error.response?.data?.message || 'No pudimos iniciar sesion. Revisa tu correo y contrasena.', 'danger');
        }
    };

    return (
        <div className={`${styles.pageContainer} d-flex justify-content-center align-items-center`} style={{ minHeight: '80vh' }}>
            <Card className={styles.loginCard}>
                <Card.Body>
                    <h1 className={styles.title}>{challengeToken ? 'Verificacion de seguridad' : 'Iniciar Sesion'}</h1>

                    {loading && <LoadingSpinner />}

                    <Form onSubmit={submitHandler}>
                        {!challengeToken && <Form.Group controlId="email" className="mb-3">
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
                        </Form.Group>}

                        {!challengeToken && <Form.Group controlId="password" className="mb-4">
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
                        </Form.Group>}

                        {challengeToken && <Form.Group controlId="securityCode" className="mb-4">
                            <Form.Label className={styles.label}>Codigo de autenticacion o recuperacion</Form.Label>
                            <Form.Control
                                value={securityCode}
                                onChange={(event) => setSecurityCode(event.target.value)}
                                placeholder="000000 o XXXXX-XXXXX"
                                autoComplete="one-time-code"
                                inputMode="text"
                                autoFocus
                                required
                            />
                            <Form.Text>Abre tu aplicacion autenticadora. Tambien puedes usar uno de tus codigos de recuperacion.</Form.Text>
                        </Form.Group>}

                        <Button
                            type="submit"
                            variant="primary"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Verificando...' : challengeToken ? 'Verificar y entrar' : 'Entrar'}
                        </Button>
                        {challengeToken && <Button type="button" variant="link" className="w-100 mt-2" onClick={() => { setChallengeToken(''); setSecurityCode(''); }}>
                            Volver a correo y contrasena
                        </Button>}
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
