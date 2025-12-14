import axios from 'axios';

// Usamos la variable de entorno REACT_APP_API_URL o localhost por defecto
// Esta es la URL base del backend (ej: http://localhost:5000)
// El prefijo /api se añade en la configuración de axios más abajo.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
    // Concatenamos la URL base con el prefijo de la API.
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// -------------------------------------------------------------------
// INTERCEPTOR DE PETICIONES: INYECTA EL TOKEN DE AUTENTICACIÓN
// -------------------------------------------------------------------
api.interceptors.request.use(
    (config) => {
        // Obtenemos la información de sesión del almacenamiento local
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const { token } = JSON.parse(userInfo);
                if (token) {
                    // Si hay token, lo adjuntamos como Bearer Token en el header
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                console.error("Error al parsear el token de usuario:", e);
                // Si hay un error, dejamos que la petición pase sin token.
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// -------------------------------------------------------------------
// INTERCEPTOR DE RESPUESTAS: MANEJA ERRORES GLOBALES (401 NO AUTORIZADO)
// -------------------------------------------------------------------
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Si el backend devuelve un error 401, significa que el token es inválido o expiró.
        // CRÍTICO: Nos aseguramos de que el error no provenga de un intento de login fallido.
        const isLoginAttempt = error.config.url.includes('/users/login');

        if (error.response && error.response.status === 401 && !isLoginAttempt) {
            console.warn("Sesión expirada o no autorizada (401). Limpiando sesión local.");
            
            // 1. Limpiamos la sesión del usuario inmediatamente
            localStorage.removeItem('userInfo');
            
            // 2. (MEJORA) Despachamos un evento global para notificar a la app que la sesión expiró.
            // Esto permite que AuthContext reaccione inmediatamente sin crear dependencias circulares.
            window.dispatchEvent(new Event('session-expired'));

            // 3. CRÍTICO: Aunque el componente AuthProvider gestiona el estado, 
            // a veces es necesario forzar la redirección para el Admin Layout, pero lo evitamos
            // para no crear un ciclo de dependencia. Dejamos que AuthContext maneje el estado.
        }
        return Promise.reject(error);
    }
);

export default api;