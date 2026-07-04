import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
// Importamos los contextos necesarios
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
// Componentes dependientes
import styles from './RegisterScreen.module.css'; // Importar los estilos
import LoadingSpinner from '../components/LoadingSpinner'; 

// Componente interno que usa el hook de Captcha
const RegisterFormContent = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pendingActivationEmail, setPendingActivationEmail] = useState('');
    
    const navigate = useNavigate();
    const location = useLocation();
    
    // Consumimos los contextos
    const { userInfo, register, resendVerificationEmail, loading } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);
    
    // Hook de reCAPTCHA
    const { executeRecaptcha } = useGoogleReCaptcha();

    // Redirigir a la raíz si está logueado
    const redirect = location.state?.from?.pathname || '/';

    // Efecto para redirigir si el usuario ya está logueado
    useEffect(() => {
        if (userInfo) {
            navigate(redirect);
        }
    }, [navigate, userInfo, redirect]);

    const submitHandler = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showNotification('Las contraseñas no coinciden.', 'danger');
            return;
        }

        try {
            if (!executeRecaptcha) {
                showNotification('El sistema de seguridad no está listo. Recarga la página.', 'warning');
                return;
            }

            // Generar token de reCAPTCHA (acción: 'register')
            const token = await executeRecaptcha('register');
            const result = await register(name, email, password, token);
            if (result?.requireActivation) {
                showNotification(result.message || 'Registro exitoso. Revisa tu correo para activar tu cuenta.', 'success');
                setPendingActivationEmail(email);
                setName('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
            }
        } catch (error) {
            // Mostrar error de la API
            showNotification(error.response?.data?.message || 'Error de registro. Inténtelo de nuevo.', 'danger');
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
                        
                        {/* Campo Nombre */}
                        <Form.Group controlId='name' className="mb-3">
                            <Form.Label className={styles.label}>Nombre Completo</Form.Label>
                            <Form.Control
                                type='text'
                                placeholder='Introduce tu nombre'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={styles.input}
                                required
                            ></Form.Control>
                        </Form.Group>

                        {/* Campo Email */}
                        <Form.Group controlId='email' className="mb-3">
                            <Form.Label className={styles.label}>Correo Electrónico</Form.Label>
                            <Form.Control
                                type='email'
                                placeholder='Introduce tu email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                required
                            ></Form.Control>
                        </Form.Group>

                        {/* Campo Contraseña */}
                        <Form.Group controlId='password' className="mb-3">
                            <Form.Label className={styles.label}>Contraseña</Form.Label>
                            <Form.Control
                                type='password'
                                placeholder='Introduce tu contraseña'
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                required
                            ></Form.Control>
                        </Form.Group>
                        
                        {/* Campo Confirmar Contraseña */}
                        <Form.Group controlId='confirmPassword' className="mb-4">
                            <Form.Label className={styles.label}>Confirmar Contraseña</Form.Label>
                            <Form.Control
                                type='password'
                                placeholder='Confirma tu contraseña'
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={styles.input}
                                required
                            ></Form.Control>
                        </Form.Group>

                        {/* Botón de Submit (usa el color de acento) */}
                        <Button 
                            type='submit' 
                            variant='primary' 
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Registrando...' : 'Registrarme'}
                        </Button>
                    </Form>

                    {/* Enlace de Login */}
                    <div className={styles.linkRow}>
                        ¿Ya tienes cuenta?{' '}
                        <Link to={redirect ? `/login?redirect=${redirect}` : '/login'} className={styles.loginLink}>
                            Entrar
                        </Link>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

// Componente contenedor que provee el contexto de reCAPTCHA
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
