import { useState, useEffect, useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import apiService from '../services/apiService';

/**
 * Hook para obtener el contenido de una página estática (como políticas)
 * desde la tabla de configuraciones.
 *
 * @param {string} pageKey - La clave de la configuración que almacena el contenido (ej. 'page_privacy_policy').
 * @returns {{content: string, loading: boolean, error: string | null}}
 */
const usePageContent = (pageKey) => {
  const { settings, loading: settingsLoading } = useContext(SettingsContext);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      // Primero, intenta obtener el valor del contexto global para optimizar.
      if (!settingsLoading && settings[pageKey]) {
        setContent(settings[pageKey]);
        setLoading(false);
      } else if (!settingsLoading) {
        // Si no está en el contexto, hace una llamada específica a la API.
        try {
          const { data } = await apiService.get(`/api/settings/key/${pageKey}`);
          setContent(data.value || '');
        } catch (err) {
          setError(err.response?.data?.message || 'Error al cargar el contenido.');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchContent();
  }, [pageKey, settings, settingsLoading]);

  return { content, loading, error };
};

export default usePageContent;