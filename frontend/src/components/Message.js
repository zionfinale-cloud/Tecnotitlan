import React from 'react';
import { Alert } from 'react-bootstrap';

/**
 * Componente reutilizable para mostrar mensajes de alerta de Bootstrap.
 * @param {string} variant - Estilo de alerta (ej: 'danger', 'success', 'info').
 * @param {node} children - Contenido del mensaje.
 */
const Message = ({ variant, children }) => {
    
    // Mapeo simple para asignar íconos y estilos base
    let iconClass = 'fas fa-info-circle';
    let alertStyle = {};

    if (variant === 'danger') {
        iconClass = 'fas fa-exclamation-triangle';
        alertStyle = { backgroundColor: '#FBE9E7', color: '#D8000C' }; // Rojo pálido con texto oscuro
    } else if (variant === 'success') {
        iconClass = 'fas fa-check-circle';
        alertStyle = { backgroundColor: '#D4EDDA', color: '#155724' }; // Verde pálido con texto oscuro
    } else if (variant === 'info') {
        iconClass = 'fas fa-info-circle';
        // Usamos nuestro color de acento, pero con un fondo más claro
        alertStyle = { backgroundColor: 'var(--cta-color)', color: 'var(--brand-dark)' }; 
    }

    return (
        <Alert 
            variant={variant} 
            className="rounded-lg border-0 shadow-sm fw-medium"
            style={alertStyle}
        >
            <i className={`${iconClass} me-2`}></i>
            {children}
        </Alert>
    );
};

Message.defaultProps = {
    variant: 'info',
};

export default Message;