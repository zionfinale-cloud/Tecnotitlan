import React, { useContext } from 'react';
import { Spinner } from 'react-bootstrap';
// Importamos el contexto que provee el estado de carga global
import { LoadingContext } from '../context/LoadingContext'; 

/**
 * Muestra una capa oscura y un spinner de carga global 
 * cuando hay peticiones HTTP activas (controlado por LoadingContext/loadingService).
 */
const LoadingOverlay = () => {
    const { isLoading } = useContext(LoadingContext);

    if (!isLoading) {
        return null;
    }

    // CRÍTICO: Posicionamiento fijo para cubrir toda la ventana
    const overlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Fondo oscuro y semi-transparente
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Asegura que esté por encima de todo
    };
    
    // Estilo del spinner (usa el color de acento de Dark Tecnotitlan)
    const spinnerStyle = {
        width: '4rem', 
        height: '4rem', 
        borderWidth: '0.4em', // Hacemos el spinner más grueso
        color: 'var(--cta-color)', 
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRightColor: 'var(--cta-color)',
    };

    return (
        <div style={overlayStyle}>
            <Spinner 
                animation="border" 
                role="status" 
                style={spinnerStyle}
            >
                <span className="visually-hidden">Cargando la aplicación...</span>
            </Spinner>
        </div>
    );
};

export default LoadingOverlay;