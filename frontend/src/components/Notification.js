import React, { useContext } from 'react';
import { Alert, Container } from 'react-bootstrap';
// Importamos el contexto que provee el mensaje y la función de cierre
import { NotificationContext } from '../context/NotificationContext'; 

/**
 * Muestra una alerta estática (por lo general, errores o mensajes de éxito importantes).
 * Este componente se renderiza en el Layout principal.
 */
const Notification = () => {
    const { notification, clearNotification } = useContext(NotificationContext);

    if (!notification) {
        return null;
    }

    const { message, variant } = notification;

    // Colores personalizados para Dark Tecnotitlan
    let customStyle = {};
    if (variant === 'danger') {
        customStyle = { backgroundColor: '#FFDEDE', color: '#D8000C', borderColor: '#F5C6CB' };
    } else if (variant === 'success') {
        customStyle = { backgroundColor: '#D4EDDA', color: '#155724', borderColor: '#C3E6CB' };
    } else if (variant === 'info') {
        // Usamos el color de acento para info
        customStyle = { backgroundColor: 'var(--cta-color)', color: 'var(--brand-dark)', borderColor: '#00DC82' };
    }


    return (
        // Usamos Container para asegurar que la alerta esté alineada con el contenido
        <Container className="my-3">
            <Alert 
                variant={variant} 
                onClose={clearNotification} 
                dismissible
                className="rounded-lg shadow-md border-0 fw-medium"
                style={customStyle}
            >
                {message}
            </Alert>
        </Container>
    );
};

export default Notification;