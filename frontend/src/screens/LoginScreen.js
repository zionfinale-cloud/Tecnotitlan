import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
// Importamos los contextos necesarios
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
// Componentes dependientes
import styles from './LoginScreen.module.css'; // Importar los estilos
import LoadingSpinner from '../components/LoadingSpinner'; 

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const navigate = useNavigate();
    const location = useLocation();
    
    // Consumimos los contextos
    const { userInfo, login, loading } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);

    // Obtener la URL de redirección (por defecto es la raíz)
    const redirect = location.state?.from?.pathname || '/';

    // Efecto para redirigir si el usuario ya está logueado
    useEffect(() => {
        if (userInfo) {
            navigate(redirect);
        }
    }, [navigate, userInfo, redirect]);

    const submitHandler = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            // Si el login es exitoso, el useEffect se encargará de la redirección
        } catch (error) {
            // Mostrar error de la API
            showNotification(error.response?.data?.message || 'Error de conexión. Inténtelo de nuevo.', 'danger');
        }
    };

    return (
        // El Container centrado y con max-width para formularios
        <div className={`${styles.pageContainer} d-flex justify-content-center align-items-center`} style={{ minHeight: '80vh' }}>
            <Card className={styles.loginCard}>
                <Card.Body>
                    <h1 className={styles.title}>Iniciar Sesión</h1>

                    {loading && <LoadingSpinner />} 
                    
                    <Form onSubmit={submitHandler}>
                        
                        {/* Campo Email */}
                        <Form.Group controlId='email' className="mb-3">
                            <Form.Label className={styles.label}>Correo Electrónico</Form.Label>
                            <Form.Control
                                type='email'
                                placeholder='Introduce tu email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                            ></Form.Control>
                        </Form.Group>

                        {/* Campo Contraseña */}
                        <Form.Group controlId='password' className="mb-4">
                            <Form.Label className={styles.label}>Contraseña</Form.Label>
                            <Form.Control
                                type='password'
                                placeholder='Introduce tu contraseña'
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                            ></Form.Control>
                        </Form.Group>

                        {/* Botón de Submit (usa el color de acento) */}
                        <Button 
                            type='submit' 
                            variant='primary' 
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </Form>

                    {/* Enlace de Registro */}
                    <div className={styles.linkRow}>
                        ¿Nuevo cliente?{' '}
                        <Link to={redirect ? `/register?redirect=${redirect}` : '/register'} className={styles.registerLink}>
                            Regístrate
                        </Link>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default LoginScreen;
