import React from 'react';
import { Container, Alert } from 'react-bootstrap';
import { useParams } from 'react-router-dom';

const OrderScreen = () => {
  const { id } = useParams();
  
  return (
    <Container className="py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
        <h1 className="text-4xl font-bold mb-4 border-b pb-2 text-slate-800">Detalles del Pedido</h1>
        <div className="p-5 bg-white rounded-xl shadow-lg">
            <h3 className="font-bold text-slate-800 mb-3">Pedido Número: <span style={{ color: 'var(--cta-color)' }}>{id}</span></h3>
            <Alert variant="info" className="text-center fw-bold">
                <i className="fas fa-truck me-2"></i> Detalles del envío, pago y artículos.
            </Alert>
            <p className="text-gray-600">Aquí se mostrarán los detalles completos de la orden.</p>
        </div>
    </Container>
  );
};

export default OrderScreen;