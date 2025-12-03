let activeRequests = 0;
let subscribers = [];

const notifySubscribers = () => {
    // Si hay peticiones activas, el estado de carga es true
    const isLoading = activeRequests > 0;
    subscribers.forEach(callback => callback(isLoading));
};

// Incrementa el contador y notifica
export const startLoading = () => {
    activeRequests++;
    notifySubscribers();
};

// Decrementa el contador y notifica
export const stopLoading = () => {
    // Asegura que el contador nunca sea negativo
    activeRequests = Math.max(0, activeRequests - 1); 
    notifySubscribers();
};

// Permite que los componentes se suscriban al estado de carga
export const subscribeToLoading = (callback) => {
    subscribers.push(callback);
    // Notifica inmediatamente al nuevo suscriptor del estado actual
    callback(activeRequests > 0);
    return () => {
        // Función de limpieza: elimina el suscriptor al desmontar
        subscribers = subscribers.filter(sub => sub !== callback);
    };
};