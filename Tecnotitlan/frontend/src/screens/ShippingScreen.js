import React from 'react';
import { Container } from 'react-bootstrap';

const ShippingScreen = () => {
  return (
    <Container className="py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
        <h1 className="text-4xl font-bold mb-4 border-b pb-2 text-slate-800">Dirección de Envío</h1>
        <div className="p-5 bg-white rounded-xl shadow-lg text-center">
            <i className="fas fa-truck fa-5x text-gray-400 mb-3"></i>
            <h3 className="font-bold text-slate-800">Paso 1: Dirección</h3>
            <p className="text-gray-600">Formulario para ingresar la dirección de envío.</p>
        </div>
    </Container>
  );
};

export default ShippingScreen;