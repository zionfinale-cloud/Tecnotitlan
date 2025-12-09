import React, { useContext } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
// Importamos el contexto que provee el estado del toast
import { ToastContext } from '../context/ToastContext';
import { CartContext } from '../context/CartContext'; // Para obtener detalles del carrito

/**
 * Muestra un Toast (notificación flotante) al añadir un producto al carrito
 * o al recibir un mensaje temporal.
 */
const ToastNotification = () => {
    const { toast, showToast } = useContext(ToastContext);
    const { cartItems } = useContext(CartContext);
    
    // Si toast es null, no mostramos nada
    if (!toast) {
        return null;
    }

    // --- Lógica de visualización del Contenido ---
    let title = 'Notificación';
    let body = 'Operación completada.';
    let icon = 'fas fa-info-circle';
    let headerStyle = { backgroundColor: 'var(--cta-color)', color: 'var(--brand-dark)', borderBottom: '1px solid rgba(0,0,0,0.1)' };

    // Caso 1: Item añadido al carrito (si el payload es un objeto)
    if (typeof toast === 'object' && toast.product) {
        const item = cartItems.find(x => x.product === toast.product);
        if (item) {
             title = '🛒 Artículo Añadido';
             body = `${item.qty} x ${item.name} | Total: $${(item.qty * item.price).toFixed(2)}`;
             icon = 'fas fa-check-circle';
             headerStyle.backgroundColor = '#4CAF50'; // Verde
             headerStyle.color = '#FFFFFF';
        }
    } 
    // Caso 2: Mensaje de texto simple (si el payload es string)
    else if (typeof toast === 'string') {
        body = toast;
    }

    // El ToastContainer asegura la posición fija
    return (
        <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1050 }}>
            <Toast 
                show={!!toast} 
                onClose={() => showToast(null)} // Usamos showToast(null) para limpiar el estado
                delay={3000} 
                autohide
                className="rounded-xl shadow-lg border-0"
            >
                <Toast.Header closeButton={false} style={headerStyle} className="rounded-t-xl">
                    <i className={`${icon} me-2`}></i>
                    <strong className="me-auto text-sm">{title}</strong>
                    <small className="text-white/80 text-xs">justo ahora</small>
                </Toast.Header>
                <Toast.Body className="bg-white text-gray-700 rounded-b-xl text-sm">
                    {body}
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
};

export default ToastNotification;