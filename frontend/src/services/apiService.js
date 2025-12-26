import axios from 'axios';
// Se recomienda centralizar constantes para evitar "magic strings" y facilitar el mantenimiento.
import { AUTH_STORAGE_KEY, SESSION_EXPIRED_EVENT } from '../constants';

// Usamos la variable de entorno REACT_APP_API_URL o localhost por defecto
// Esta es la URL base del backend (ej: http://localhost:5000)
// El prefijo /api se añade en la configuración de axios más abajo.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// MEJORA: Usar el constructor URL para unir la base y el path de forma segura.
// Esto evita problemas si API_BASE_URL accidentalmente termina con una barra (/).
const apiURL = new URL('/api', API_BASE_URL).href;

const api = axios.create({
    baseURL: apiURL,
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
        const userInfo = localStorage.getItem(AUTH_STORAGE_KEY); // No change here, just for context
        // Verificamos que userInfo exista y no sea la cadena "undefined" (error común)
        if (userInfo && userInfo !== 'undefined') {
            try {
                const { token } = JSON.parse(userInfo);
                if (token) {
                    // Si hay token, lo adjuntamos como Bearer Token en el header
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                console.error("Error al parsear el token de usuario:", e);
                // Si el JSON es inválido, limpiamos el storage para evitar persistencia del error
                localStorage.removeItem(AUTH_STORAGE_KEY);
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
            localStorage.removeItem(AUTH_STORAGE_KEY); // No change here, just for context
            
            // 2. (MEJORA) Despachamos un evento global para notificar a la app que la sesión expiró.
            // Esto permite que AuthContext reaccione inmediatamente sin crear dependencias circulares.
            window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); // No change here, just for context

            // 3. CRÍTICO: Aunque el componente AuthProvider gestiona el estado, 
            // a veces es necesario forzar la redirección para el Admin Layout, pero lo evitamos
            // para no crear un ciclo de dependencia. Dejamos que AuthContext maneje el estado.
        }
        // Agregamos log para Error 500 (Error interno del servidor)
        if (error.response && error.response.status === 500) {
            console.error("🔥 ERROR CRÍTICO (500): El backend falló. Verifica la conexión a la Base de Datos o las variables de entorno en el servidor.");
        }
        return Promise.reject(error);
    }
);

export default api;