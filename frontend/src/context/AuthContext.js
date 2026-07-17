import React, { createContext, useState, useEffect } from 'react';
// Asumimos que apiService.js existe en src/services/
import api from '../services/apiService';

// Creamos el contexto con un valor por defecto
export const AuthContext = createContext({
    userInfo: null,
    loading: true, // Indica si la verificación inicial de Auth ha terminado
    login: () => {},
    logout: () => {},
    register: () => {},
    verifyAccount: () => {},
    resendVerificationEmail: () => {}
});

export const AuthProvider = ({ children }) => {
    // userInfo contiene el token, nombre, email, role y permisos
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            try {
                // Leer del almacenamiento local al inicio
                const storedUserInfo = localStorage.getItem('userInfo');
                
                // FIX: Verificar que no sea la cadena "undefined" que rompe el JSON.parse
                if (storedUserInfo && storedUserInfo !== 'undefined') {
                    setUserInfo(JSON.parse(storedUserInfo));
                } else if (storedUserInfo === 'undefined') {
                    // Si es basura, limpiamos
                    localStorage.removeItem('userInfo');
                }
            } catch (error) {
                console.error("Error parsing user info from storage:", error);
                localStorage.removeItem('userInfo');
            } finally {
                // CRÍTICO: Una vez que se intenta leer del storage, terminamos de cargar
                setLoading(false); 
            }
        };
        checkAuth();
    }, []);

    // MEJORA 1: Escuchar el evento de sesión expirada desde apiService
    useEffect(() => {
        const handleSessionExpired = () => {
            console.log('AuthContext: Sesión expirada detectada. Limpiando estado.');
            setUserInfo(null);
        };

        window.addEventListener('session-expired', handleSessionExpired);
        return () => window.removeEventListener('session-expired', handleSessionExpired);
    }, []);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post('/users/login', { email, password });
            setUserInfo(data.data); // FIX: El objeto de usuario está en data.data
            localStorage.setItem('userInfo', JSON.stringify(data.data));
            return data.data;
        } finally {
            setLoading(false);
        }
    };

    const register = async (name, email, phone, password, captchaToken) => {
        setLoading(true);
        try {
            const { data } = await api.post('/users/register', { name, email, phone, password, captchaToken });
            
            // Si requiere activación, el backend no devuelve el usuario logueado inmediatamente
            if (data.status === 'success' && !data.data?.user) {
                return { success: true, requireActivation: true, message: data.message };
            }

            setUserInfo(data.data.user);
            localStorage.setItem('userInfo', JSON.stringify(data.data.user));
            return { success: true, user: data.data.user };
        } finally {
            setLoading(false);
        }
    };

    const verifyAccount = async (token) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/users/confirm/${token}`);
            return data;
        } finally {
            setLoading(false);
        }
    };

    const resendVerificationEmail = async (email) => {
        const { data } = await api.post('/users/resend-verification', { email });
        return data;
    };

    const logout = () => {
        // Enviar petición de logout al backend para limpiar el cookie HTTP-Only
        api.post('/users/logout').catch(e => console.error("Error al hacer logout en API:", e)); 
        
        localStorage.removeItem('userInfo');
        setUserInfo(null);
        // La redirección a /login se maneja en el componente Header
    };
    
    // Función para actualizar los datos del usuario después de una edición de perfil
    const updateProfile = (updatedUser) => {
        // MEJORA 2: Usar la forma funcional para garantizar la consistencia del estado
        setUserInfo(prevUserInfo => {
            const newUserInfo = { ...prevUserInfo, ...updatedUser };
            localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
            return newUserInfo;
        });
    }

    return (
        <AuthContext.Provider value={{ userInfo, loading, login, logout, register, updateProfile, verifyAccount, resendVerificationEmail }}>
            {children}
        </AuthContext.Provider>
    );
};
