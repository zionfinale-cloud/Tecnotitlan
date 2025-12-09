import React, { createContext, useState } from 'react';

// Definimos valores por defecto
export const NotificationContext = createContext({
    notification: null, // { message: '...', variant: 'danger' }
    showNotification: () => {},
    clearNotification: () => {}
});

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);

    /**
     * Muestra una notificación de alerta persistente (hasta que se cierre o expire).
     * @param {string} message - El mensaje a mostrar.
     * @param {string} variant - La variante de Bootstrap (ej: 'danger', 'success', 'info').
     */
    const showNotification = (message, variant = 'info') => {
        setNotification({ message, variant });
        // Auto-limpieza después de 5 segundos, pero el usuario puede cerrarla manualmente
        setTimeout(() => {
            setNotification(null);
        }, 5000);
    };

    const clearNotification = () => {
        setNotification(null);
    };

    return (
        <NotificationContext.Provider value={{ notification, showNotification, clearNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};