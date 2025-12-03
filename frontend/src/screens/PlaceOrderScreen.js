import React from 'react';
import { Container } from 'react-bootstrap';

const PlaceOrderScreen = () => {
  return (
    <Container className="py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
        <h1 className="text-4xl font-bold mb-4 border-b pb-2 text-slate-800">Resumen y Pedido</h1>
        <div className="p-5 bg-white rounded-xl shadow-lg text-center">
            <i className="fas fa-receipt fa-5x text-gray-400 mb-3"></i>
            <h3 className="font-bold text-slate-800">Paso 3: Confirmación</h3>
            <p className="text-gray-600">Revisión final de la orden antes de realizar el pago.</p>
        </div>
    </Container>
  );
};

export default PlaceOrderScreen;