import React, { useContext } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Row, Col, ListGroup } from 'react-bootstrap';
import { AuthContext } from '../../context/AuthContext';

const SettingsPage = () => {
  const { userInfo } = useContext(AuthContext);
  const isSuperAdmin = userInfo?.role === 'SUPER_ADMIN' || userInfo?.role?.name === 'SUPER_ADMIN';

  if (!isSuperAdmin) {
    return (
      <div className="p-4 border rounded-xl bg-white shadow-sm">
        <h1 className="fw-bold">Configuracion restringida</h1>
        <p className="text-muted mb-0">Solo el Super Admin puede ver y modificar configuraciones de la pagina.</p>
      </div>
    );
  }

  const itemClass = ({ isActive }) => `cursor-pointer ${isActive ? 'bg-primary text-white fw-bold' : ''}`;

  return (
    <>
      <h1 className="fw-bold mb-2 border-bottom pb-2">Configuracion de la pagina</h1>
      <p className="text-muted mb-4">Ajustes sensibles, storefront, integraciones y contenido legal.</p>

      <Row>
        <Col md={3}>
          <ListGroup className="rounded-xl shadow-sm border-0">
            <ListGroup.Item className="bg-light fw-bold text-slate-800">Ajustes</ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/system" className={itemClass}>
              <i className="fas fa-cogs me-2"></i> Sistema
            </ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/storefront" className={itemClass}>
              <i className="fas fa-store me-2"></i> Storefront / Home
            </ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/whatsapp" className={itemClass}>
              <i className="fab fa-whatsapp me-2"></i> WhatsApp QR
            </ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/tiktok" className={itemClass}>
              <i className="fab fa-tiktok me-2"></i> TikTok Shop
            </ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/mercadolibre" className={itemClass}>
              <i className="fas fa-handshake me-2"></i> Mercado Libre
            </ListGroup.Item>
            <ListGroup.Item as={NavLink} to="/admin/settings/legal" className={itemClass}>
              <i className="fas fa-gavel me-2"></i> Paginas legales
            </ListGroup.Item>
          </ListGroup>
        </Col>

        <Col md={9}>
          <div className="p-4 border rounded-xl bg-white shadow-sm min-h-[500px]">
            <Outlet />
          </div>
        </Col>
      </Row>
    </>
  );
};

export default SettingsPage;
