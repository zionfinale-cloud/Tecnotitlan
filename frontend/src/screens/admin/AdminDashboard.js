import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';

const AdminDashboard = () => {
  return (
    <>
      <h1 className="text-4xl font-bold mb-4 text-slate-800">Dashboard de Administración</h1>
      <p className="text-gray-600 mb-5">Bienvenido al Panel de Control. Aquí verás las estadísticas principales del negocio.</p>
      
      <Row>
        <Col md={4} className="mb-4">
          <Card className="rounded-xl shadow-sm border-0">
            <Card.Body>
              <h5 className="font-bold text-lg mb-1">Órdenes Hoy</h5>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--cta-color)' }}>$12,450</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className="rounded-xl shadow-sm border-0">
            <Card.Body>
              <h5 className="font-bold text-lg mb-1">Nuevos Usuarios</h5>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--cta-color)' }}>25</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className="rounded-xl shadow-sm border-0">
            <Card.Body>
              <h5 className="font-bold text-lg mb-1">Productos Activos</h5>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--cta-color)' }}>145</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <div className="mt-5 p-4 bg-gray-50 rounded-lg border border-dashed text-center">
          <p className="text-gray-500 mb-0">Esta es la vista de un administrador.</p>
      </div>
    </>
  );
};

export default AdminDashboard;