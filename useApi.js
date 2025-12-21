import { useState, useCallback, useContext }from 'react';
import apiService from '../services/apiService';
import { ToastContext } from '../context/ToastContext';

/**
 * Un hook genérico y robusto para realizar llamadas a la API.
 * Maneja estados de carga, errores y notificaciones de éxito/error.
 * @returns {{data: any, loading: boolean, error: string | null, request: Function}}
 */
const useApi = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showToast } = useContext(ToastContext);

  const request = useCallback(async (method, url, body = null, successMessage = null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService[method](url, body);
      setData(response.data);
      
      // Muestra una notificación de éxito si se proporciona un mensaje
      if (successMessage) {
        showToast('success', 'Éxito', successMessage);
      }

      return response.data;
    } catch (err) {
      // Extrae el mensaje de error de la respuesta de la API
      const errorMessage = err.response?.data?.message || 'Ocurrió un error inesperado.';
      setError(errorMessage);
      
      // Muestra una notificación de error
      showToast('error', 'Error', errorMessage);
      
      // Propagamos el error para que el componente que llama pueda reaccionar si es necesario
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  return { data, loading, error, request };
};

export default useApi;