import React, { createContext, useState } from 'react';

// Valores por defecto
export const ToastContext = createContext({
    toast: null, // Contiene el mensaje o el ítem añadido
    showToast: () => {}
});

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);

    /**
     * Muestra una notificación temporal.
     * @param {object|string} item - El mensaje o el objeto de datos a mostrar.
     */
    const showToast = (item) => {
        setToast(item); 
        // Desaparece automáticamente después de 3 segundos (3000ms)
        setTimeout(() => {
            setToast(null);
        }, 3000); 
    };

    return (
        <ToastContext.Provider value={{ toast, showToast }}>
            {children}
        </ToastContext.Provider>
    );
};