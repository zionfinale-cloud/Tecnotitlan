import React from 'react';
import { Spinner } from 'react-bootstrap';

const LoadingSpinner = () => {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
      <Spinner animation="border" role="status" style={{ width: '3rem', height: '3rem', color: 'var(--cta-color)' }}>
        <span className="visually-hidden">Cargando...</span>
      </Spinner>
    </div>
  );
};

export default LoadingSpinner;