import React from 'react';
import { Container } from 'react-bootstrap';
import usePageContent from '../hooks/usePageContent';
import LoadingSpinner from '../components/LoadingSpinner';
import Message from '../components/Message';

const PrivacyPolicy = () => {
  const { content, loading, error } = usePageContent('page_privacy_policy');

  return (
    <Container className="py-5 mt-5">
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <>
          <h1>Política de Privacidad</h1>
          {/* Renderiza de forma segura el contenido HTML obtenido de la base de datos */}
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </>
      )}
    </Container>
  );
};

export default PrivacyPolicy;