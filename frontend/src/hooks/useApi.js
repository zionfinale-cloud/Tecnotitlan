import { useState, useCallback } from 'react';
import api from '../services/apiService'; // Importamos la instancia de axios directamente

/**
 * Hook personalizado para realizar peticiones a la API y gestionar estados.
 * Utiliza el `apiService` centralizado para ejecutar las llamadas.
 *
 * @param {Function} [onSuccess] - Callback opcional que se ejecuta si la petición es exitosa.
 * @param {Function} [onError] - Callback opcional que se ejecuta si la petición falla.
 * @returns {{
 *   data: any | null;
 *   error: string | null;
 *   loading: boolean;
 *   request: (method: 'get' | 'post' | 'put' | 'delete' | 'patch', ...args: any[]) => Promise<any>;
 * }}
 *
 * @example
 * const { data: products, loading, error, request } = useApi();
 *
 * useEffect(() => {
 *   const fetchProducts = () => request('get', '/products');
 *   fetchProducts();
 * }, [request]);
 *
 * if (loading) return <p>Cargando...</p>;
 * if (error) return <p>Error: {error}</p>;
 * return <div>{JSON.stringify(products)}</div>;
 */
export const useApi = (onSuccess, onError) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const request = useCallback(async (method, ...args) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api[method](...args);
            setData(response.data);
            if (onSuccess) onSuccess(response.data);
            return response.data; // Devuelve los datos para poder encadenar promesas si es necesario
        } catch (err) {
            // Extraemos el mensaje de error más relevante
            const errorMessage = err.response?.data?.message || err.message || 'Ocurrió un error inesperado.';
            setError(errorMessage);
            if (onError) onError(errorMessage);
            console.error("Error en la llamada API:", err);
            throw err; // Re-lanzamos el error para que el componente que llama pueda manejarlo si es necesario
        } finally {
            setLoading(false);
        }
    }, [onSuccess, onError]);

    return { data, error, loading, request };
};

export default useApi;