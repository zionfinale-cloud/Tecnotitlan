import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Row, Col, Card, Container } from 'react-bootstrap';
// Importamos los contextos necesarios
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
// Componentes dependientes
import LoadingSpinner from '../components/LoadingSpinner'; 

const RegisterScreen = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const navigate = useNavigate();
    const location = useLocation();
    
    // Consumimos los contextos
    const { userInfo, register, loading } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);

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
            const success = await register(name, email, password);
            // Asumimos que la función register devuelve `true` al tener éxito
            if (success) navigate(redirect); // Redirigir explícitamente al tener éxito
        } catch (error) {
            // Mostrar error de la API
            showNotification(error.response?.data?.message || 'Error de registro. Inténtelo de nuevo.', 'danger');
        }
    };

    return (
        <Container className="d-flex justify-content-center py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
            <Row className="w-full">
                <Col md={8} lg={6} xl={5} className="mx-auto">
                    <Card className="p-4 rounded-xl border-0 shadow-lg">
                        <Card.Body>
                            <h1 className="text-3xl font-bold mb-4 text-center">Crear Cuenta</h1>
                            
                            {loading && <LoadingSpinner />} 
                            
                            <Form onSubmit={submitHandler}>
                                
                                {/* Campo Nombre */}
                                <Form.Group controlId='name' className="mb-3">
                                    <Form.Label className="font-medium">Nombre Completo</Form.Label>
                                    <Form.Control
                                        type='text'
                                        placeholder='Introduce tu nombre'
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="rounded-lg shadow-sm focus:border-0"
                                        required
                                    ></Form.Control>
                                </Form.Group>

                                {/* Campo Email */}
                                <Form.Group controlId='email' className="mb-3">
                                    <Form.Label className="font-medium">Correo Electrónico</Form.Label>
                                    <Form.Control
                                        type='email'
                                        placeholder='Introduce tu email'
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="rounded-lg shadow-sm focus:border-0"
                                        required
                                    ></Form.Control>
                                </Form.Group>

                                {/* Campo Contraseña */}
                                <Form.Group controlId='password' className="mb-3">
                                    <Form.Label className="font-medium">Contraseña</Form.Label>
                                    <Form.Control
                                        type='password'
                                        placeholder='Introduce tu contraseña'
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="rounded-lg shadow-sm focus:border-0"
                                        required
                                    ></Form.Control>
                                </Form.Group>
                                
                                {/* Campo Confirmar Contraseña */}
                                <Form.Group controlId='confirmPassword' className="mb-4">
                                    <Form.Label className="font-medium">Confirmar Contraseña</Form.Label>
                                    <Form.Control
                                        type='password'
                                        placeholder='Confirma tu contraseña'
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="rounded-lg shadow-sm focus:border-0"
                                        required
                                    ></Form.Control>
                                </Form.Group>

                                {/* Botón de Submit (usa el color de acento) */}
                                <Button 
                                    type='submit' 
                                    variant='primary' 
                                    className="w-full rounded-full py-2 mb-3"
                                    disabled={loading}
                                >
                                    {loading ? 'Registrando...' : 'Registrarme'}
                                </Button>
                            </Form>

                            {/* Enlace de Login */}
                            <Row className="py-3 text-center">
                                <Col>
                                    ¿Ya tienes cuenta?{' '}
                                    <Link to={redirect ? `/login?redirect=${redirect}` : '/login'} className="text-decoration-none" style={{ color: 'var(--cta-color)' }}>
                                        Entrar
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

export default RegisterScreen;