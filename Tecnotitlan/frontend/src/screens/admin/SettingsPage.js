import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Row, Col, ListGroup } from 'react-bootstrap';

const SettingsPage = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4 border-b pb-2">Configuración del Sistema</h1>
      <p className="text-gray-600 mb-5">Administra los ajustes globales de la tienda, integraciones y notificaciones.</p>
      
      <Row>
        {/* Sidebar de Configuración */}
        <Col md={3}>
          <ListGroup className="rounded-xl shadow-sm border-0">
            <ListGroup.Item className="bg-gray-50 fw-bold border-b text-slate-800">Ajustes</ListGroup.Item>
            <ListGroup.Item 
                as={NavLink} 
                to="/admin/settings/whatsapp" 
                className={({ isActive }) => `cursor-pointer ${isActive ? 'bg-primary text-white font-bold' : ''}`}
            >
                <i className="fab fa-whatsapp me-2"></i> Integración WhatsApp
            </ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/general">
                <i className="fas fa-paint-brush me-2"></i> Apariencia & Datos
            </ListGroup.Item>
          </ListGroup>
        </Col>
        
        {/* Contenido de la Sub-ruta */}
        <Col md={9}>
            <div className="p-4 border rounded-xl bg-white shadow-sm min-h-[500px]">
                <Outlet /> {/* Aquí se renderiza WhatsappSettingsScreen */}
            </div>
        </Col>
      </Row>
    </>
  );
};

export default SettingsPage;