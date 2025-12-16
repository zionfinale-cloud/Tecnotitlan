import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Row, Col, Card, Container } from 'react-bootstrap';
// Importamos los contextos necesarios
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
// Componentes dependientes
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
            const success = await login(email, password);
            if (success) navigate(redirect); // Redirigir explícitamente al tener éxito
        } catch (error) {
            // Mostrar error de la API
            showNotification(error.response?.data?.message || 'Error de conexión. Inténtelo de nuevo.', 'danger');
        }
    };

    return (
        // El Container centrado y con max-width para formularios
        <Container className="d-flex justify-content-center py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
            <Row className="w-full">
                <Col md={6} lg={5} xl={4} className="mx-auto">
                    <Card className="p-4 rounded-xl border-0 shadow-lg">
                        <Card.Body>
                            <h1 className="text-3xl font-bold mb-4 text-center">Iniciar Sesión</h1>

                            {loading && <LoadingSpinner />} 
                            
                            <Form onSubmit={submitHandler}>
                                
                                {/* Campo Email */}
                                <Form.Group controlId='email' className="mb-3">
                                    <Form.Label className="font-medium">Correo Electrónico</Form.Label>
                                    <Form.Control
                                        type='email'
                                        placeholder='Introduce tu email'
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="rounded-lg shadow-sm focus:border-0"
                                    ></Form.Control>
                                </Form.Group>

                                {/* Campo Contraseña */}
                                <Form.Group controlId='password' className="mb-4">
                                    <Form.Label className="font-medium">Contraseña</Form.Label>
                                    <Form.Control
                                        type='password'
                                        placeholder='Introduce tu contraseña'
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="rounded-lg shadow-sm focus:border-0"
                                    ></Form.Control>
                                </Form.Group>

                                {/* Botón de Submit (usa el color de acento) */}
                                <Button 
                                    type='submit' 
                                    variant='primary' 
                                    className="w-full rounded-full py-2 mb-3"
                                    disabled={loading}
                                >
                                    {loading ? 'Entrando...' : 'Entrar'}
                                </Button>
                            </Form>

                            {/* Enlace de Registro */}
                            <Row className="py-3 text-center">
                                <Col>
                                    ¿Nuevo cliente?{' '}
                                    <Link to={redirect ? `/register?redirect=${redirect}` : '/register'} className="text-decoration-none" style={{ color: 'var(--cta-color)' }}>
                                        Regístrate
                                    </Link>
                                </Col>
                            </Row>

                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default LoginScreen;