import React from 'react';
import { Container } from 'react-bootstrap';

const PaymentScreen = () => {
  return (
    <Container className="py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
        <h1 className="text-4xl font-bold mb-4 border-b pb-2 text-slate-800">Método de Pago</h1>
        <div className="p-5 bg-white rounded-xl shadow-lg text-center">
            <i className="fas fa-credit-card fa-5x text-gray-400 mb-3"></i>
            <h3 className="font-bold text-slate-800">Paso 2: Pago</h3>
            <p className="text-gray-600">Selección del método de pago (PayPal, Stripe, etc.).</p>
        </div>
    </Container>
  );
};

export default PaymentScreen;