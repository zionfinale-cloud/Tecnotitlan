import React from 'react';
import { Container } from 'react-bootstrap';
import usePageContent from '../hooks/usePageContent';
import LoadingSpinner from '../components/LoadingSpinner';
import Message from '../components/Message';

const TermsOfService = () => {
  const { content, loading, error } = usePageContent('page_terms_of_service');

  return (
    <Container className="py-5 mt-5">
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <>
          <h1>Términos de Servicio</h1>
          {/* Renderiza de forma segura el contenido HTML obtenido de la base de datos */}
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </>
      )}
    </Container>
  );
};

export default TermsOfService;