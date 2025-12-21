import React, { useEffect, useState } from 'react';
import { Container, Spinner, Alert } from 'react-bootstrap';
import useApi from '../hooks/useApi';

const PrivacyPolicy = () => {
  const { data, loading, error, request } = useApi();
  const [content, setContent] = useState('');

  useEffect(() => {
    // Obtenemos la configuración pública
    request('get', '/api/settings');
  }, [request]);

  useEffect(() => {
    if (data?.data) {
      const settingsMap = data.data.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      setContent(settingsMap.page_privacy_policy || '<p>No hay política de privacidad definida aún.</p>');
    }
  }, [data]);

  return (
    <Container className="py-5">
      <h1 className="mb-4">Política de Privacidad</h1>
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        // Renderizamos el HTML guardado por el editor de texto
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </Container>
  );
};

export default PrivacyPolicy;