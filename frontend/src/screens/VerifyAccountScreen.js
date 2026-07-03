import React, { useContext, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const cardStyle = {
  maxWidth: 520,
  width: '100%',
  background: 'var(--surface-raised)',
  border: '1px solid var(--line)',
  borderRadius: 18,
  padding: '2rem',
  textAlign: 'center',
  boxShadow: 'var(--shadow)',
};

const VerifyAccountScreen = () => {
  const { token: tokenParam } = useParams();
  const [searchParams] = useSearchParams();
  const { verifyAccount } = useContext(AuthContext);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const token = tokenParam || searchParams.get('token');

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await verifyAccount(token);
        if (response.status === 'success') {
          setStatus('success');
          setMessage('Tu cuenta fue activada correctamente. Ya puedes iniciar sesión y comprar.');
        } else {
          setStatus('error');
          setMessage(response.message || 'No se pudo activar la cuenta.');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'El enlace es inválido o ha expirado.');
      }
    };

    if (token) {
      verify();
    } else {
      setStatus('error');
      setMessage('Token de verificación no proporcionado.');
    }
    // verifyAccount updates global loading state, so keeping it out avoids duplicate token consumption.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={cardStyle}>
        {status === 'loading' && (
          <>
            <i className="fas fa-spinner fa-spin" style={{ color: 'var(--cta-color)', fontSize: '2rem', marginBottom: '1rem' }}></i>
            <h2>Verificando cuenta...</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <i className="fas fa-check-circle" style={{ color: 'var(--cta-color)', fontSize: '2.4rem', marginBottom: '1rem' }}></i>
            <h2>Cuenta activada</h2>
            <p style={{ color: 'var(--muted)' }}>{message}</p>
            <Link to="/login" className="btn btn-primary">Iniciar sesión</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <i className="fas fa-times-circle" style={{ color: '#ff6b6b', fontSize: '2.4rem', marginBottom: '1rem' }}></i>
            <h2>Error de activación</h2>
            <p style={{ color: 'var(--muted)' }}>{message}</p>
            <Link to="/" style={{ color: 'var(--cta-color)', fontWeight: 800 }}>Volver al inicio</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyAccountScreen;
