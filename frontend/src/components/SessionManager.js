import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SESSION_EXPIRED_EVENT } from '../constants';

/**
 * Componente sin UI que gestiona eventos de sesión globales.
 * Se debe colocar dentro del Router en App.js.
 */
const SessionManager = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = () => {
      navigate('/login');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [navigate]);

  return null; // Este componente no renderiza nada.
};

export default SessionManager;