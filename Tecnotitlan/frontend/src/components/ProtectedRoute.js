import React, { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
// Importación directa del componente de carga
import LoadingSpinner from './LoadingSpinner'; 

/**
 * Componente de Ruta Protegida.
 * Revisa el estado de autenticación antes de permitir el acceso.
 * @param {boolean} adminOnly - Si es true, solo permite el acceso a administradores.
 */
const ProtectedRoute = ({ children, adminOnly = false }) => {
    // userInfo contiene el token, permisos, etc.
    const { userInfo: user, loading } = useContext(AuthContext); 
    const location = useLocation();

    // 1. Muestra un spinner mientras se carga el estado de autenticación
    if (loading) {
        return <LoadingSpinner />;
    }

    // 2. Si no está logueado, redirige a /login
    if (!user) {
        // Guarda la ruta a la que intentaba acceder en el estado para redireccionar después
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. Verificación de Administrador (si se requiere)
    // Asumimos que 'access:admin_panel' es el permiso requerido.
    const canAccessAdmin = user.permissions?.includes('access:admin_panel');

    if (adminOnly && !canAccessAdmin) {
        // Si no tiene el permiso de admin, lo enviamos al Home.
        return <Navigate to="/" replace />;
    }

    // Si pasa todas las pruebas, renderiza el contenido
    return children ? children : <Outlet />;
};

export default ProtectedRoute;
