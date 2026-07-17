import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import styles from './RegisterScreen.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const RegisterFormContent = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pendingActivationEmail, setPendingActivationEmail] = useState('');

    const navigate = useNavigate();
    const location = useLocation();
    const { userInfo, register, resendVerificationEmail, loading } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);
    const { executeRecaptcha } = useGoogleReCaptcha();

    const redirect = location.state?.from?.pathname || '/';
    const passwordsDoNotMatch = confirmPassword.length > 0 && password !== confirmPassword;

    useEffect(() => {
        if (userInfo) {
            navigate(redirect);
        }
    }, [navigate, userInfo, redirect]);

    const submitHandler = async (event) => {
        event.preventDefault();

        if (password !== confirmPassword) {
            showNotification('Las contrasenas no coinciden.', 'danger');
            return;
        }

        try {
            if (!executeRecaptcha) {
                showNotification('El sistema de seguridad no esta listo. Recarga la pagina.', 'warning');
                return;
            }

            const token = await executeRecaptcha('register');
            const result = await register(name, email, phone, password, token);

            if (result?.requireActivation) {
                showNotification(result.message || 'Registro exitoso. Revisa tu correo para activar tu cuenta.', 'success');
                setPendingActivationEmail(email);
                setName('');
                setEmail('');
                setPhone('');
                setPassword('');
                setConfirmPassword('');
            }
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error de registro. Intentalo de nuevo.', 'danger');
        }
    };

    const resendHandler = async () => {
        if (!pendingActivationEmail) return;

        try {
            const result = await resendVerificationEmail(pendingActivationEmail);
            showNotification(result.message || 'Te enviamos un nuevo correo de activacion.', 'success');
        } catch (error) {
            showNotification(error.response?.data?.message || 'No pudimos reenviar la activacion.', 'danger');
        }
    };

    return (
        <div className={styles.pageContainer}>
            <Card className={styles.registerCard}>
                <Card.Body>
                    <h1 className={styles.title}>Crear Cuenta</h1>

                    {loading && <LoadingSpinner />}

                    {pendingActivationEmail && (
                        <div className={styles.activationNotice}>
                            <strong>Cuenta pendiente de activar</strong>
                            <p>
                                Enviamos el enlace a <span>{pendingActivationEmail}</span>. Revisa tambien spam o promociones.
                            </p>
                            <Button type="button" className={styles.resendButton} onClick={resendHandler} disabled={loading}>
                                Reenviar activacion
                            </Button>
                        </div>
                    )}

                    <Form onSubmit={submitHandler}>
                        <Form.Group controlId="name" className="mb-3">
                            <Form.Label className={styles.label}>Nombre completo</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Introduce tu nombre"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className={styles.input}
                                autoComplete="name"
                                required
                            />
                        </Form.Group>

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

                        <Form.Group controlId="phone" className="mb-3">
                            <Form.Label className={styles.label}>Celular / WhatsApp</Form.Label>
                            <Form.Control
                                type="tel"
                                placeholder="Ej. 3481510949"
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                className={styles.input}
                                autoComplete="tel"
                                inputMode="tel"
                                required
                            />
                            <p className={styles.helperText}>Lo usamos para seguimiento, guias y avisos de tu pedido.</p>
                        </Form.Group>

                        <Form.Group controlId="password" className="mb-3">
                            <Form.Label className={styles.label}>Contrasena</Form.Label>
                            <div className={styles.passwordField}>
                                <Form.Control
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Introduce tu contrasena"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className={styles.input}
                                    autoComplete="new-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    minLength={8}
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

                        <Form.Group controlId="confirmPassword" className="mb-4">
                            <Form.Label className={styles.label}>Confirmar contrasena</Form.Label>
                            <div className={styles.passwordField}>
                                <Form.Control
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="Confirma tu contrasena"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className={`${styles.input} ${passwordsDoNotMatch ? styles.inputError : ''}`}
                                    autoComplete="new-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    minLength={8}
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowConfirmPassword((value) => !value)}
                                    aria-label={showConfirmPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                                >
                                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                            {passwordsDoNotMatch && (
                                <p className={styles.fieldError}>Las contrasenas no coinciden.</p>
                            )}
                        </Form.Group>

                        <Button
                            type="submit"
                            variant="primary"
                            className={styles.submitButton}
                            disabled={loading || passwordsDoNotMatch}
                        >
                            {loading ? 'Registrando...' : 'Registrarme'}
                        </Button>
                    </Form>

                    <div className={styles.linkRow}>
                        Ya tienes cuenta?{' '}
                        <Link to={redirect ? `/login?redirect=${redirect}` : '/login'} className={styles.loginLink}>
                            Entrar
                        </Link>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

const RegisterScreen = () => {
    const recaptchaKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

    if (!recaptchaKey) {
        return <RegisterFormContent />;
    }

    return (
        <GoogleReCaptchaProvider reCaptchaKey={recaptchaKey}>
            <RegisterFormContent />
        </GoogleReCaptchaProvider>
    );
};

export default RegisterScreen;
