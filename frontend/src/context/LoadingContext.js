import React, { createContext, useState, useEffect } from 'react';
// Importamos el servicio de utilidad (debe existir en src/utils/loadingService.js)
import { subscribeToLoading, startLoading, stopLoading } from '../utils/loadingService'; 

export const LoadingContext = createContext({
    isLoading: false,
    startLoading: () => {},
    stopLoading: () => {},
});

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Suscribirse al estado de carga global del servicio
        const unsubscribe = subscribeToLoading(setIsLoading);
        return () => unsubscribe(); // Limpiar la suscripción
    }, []);

    return (
        <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
            {children}
        </LoadingContext.Provider>
    );
};