import React, { createContext, useState, useEffect } from 'react';
// Asumimos que apiService.js existe en src/services/
import api from '../services/apiService'; 

// Creamos el contexto con un valor por defecto
export const AuthContext = createContext({
    userInfo: null,
    loading: true, // Indica si la verificación inicial de Auth ha terminado
    login: () => {},
    logout: () => {},
    register: () => {}
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
                if (storedUserInfo) {
                    setUserInfo(JSON.parse(storedUserInfo));
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

    const login = async (email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post('/users/login', { email, password });
            setUserInfo(data.data.user); // Usar data.data.user por el formato de respuesta del backend
            localStorage.setItem('userInfo', JSON.stringify(data.data.user));
            return data.data.user;
        } finally {
            setLoading(false);
        }
    };

    const register = async (name, email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post('/users/register', { name, email, password });
            setUserInfo(data.data.user);
            localStorage.setItem('userInfo', JSON.stringify(data.data.user));
            return data.data.user;
        } finally {
            setLoading(false);
        }
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
        setUserInfo(prev => ({ ...prev, ...updatedUser }));
        localStorage.setItem('userInfo', JSON.stringify({ ...userInfo, ...updatedUser }));
    }

    return (
        <AuthContext.Provider value={{ userInfo, loading, login, logout, register, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};