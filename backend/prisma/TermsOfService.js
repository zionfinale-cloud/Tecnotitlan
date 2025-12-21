import React, { useEffect, useState } from 'react';
import { Container, Spinner, Alert } from 'react-bootstrap';
import useApi from '../hooks/useApi';

const TermsOfService = () => {
  const { data, loading, error, request } = useApi();
  const [content, setContent] = useState('');

  useEffect(() => {
    request('get', '/api/settings');
  }, [request]);

  useEffect(() => {
    if (data?.data) {
      const settingsMap = data.data.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      setContent(settingsMap.page_terms_of_service || '<p>No hay términos de servicio definidos aún.</p>');
    }
  }, [data]);

  return (
    <Container className="py-5">
      <h1 className="mb-4">Términos de Servicio</h1>
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </Container>
  );
};

export default TermsOfService;