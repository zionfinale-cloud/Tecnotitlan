import React from 'react';
import { Container } from 'react-bootstrap';

const ProfileScreen = () => {
  return (
    <Container className="py-5" style={{ minHeight: '80vh', backgroundColor: 'var(--secondary-bg-color)' }}>
        <h1 className="text-4xl font-bold mb-4 border-b pb-2 text-slate-800">Mi Perfil</h1>
        <div className="p-5 bg-white rounded-xl shadow-lg text-center">
            <i className="fas fa-user-circle fa-5x text-gray-400 mb-3"></i>
            <h3 className="font-bold text-slate-800">Información de Cuenta</h3>
            <p className="text-gray-600">Formulario para actualizar nombre y contraseña. Historial de pedidos pendiente.</p>
        </div>
    </Container>
  );
};

export default ProfileScreen;