import React, { useContext, useEffect } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import styles from './ProfileScreen.module.css';

const ProfileScreen = () => {
  const { userInfo, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userInfo) {
      navigate('/login');
    }
  }, [userInfo, navigate]);

  if (!userInfo) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className={styles.profileCard}>
            <Card.Body className="text-center p-5">
              
              {/* Avatar con iniciales */}
              <div className={styles.avatarLarge}>
                {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <h2 className="mt-4 mb-1 font-bold">{userInfo.name}</h2>
              <p className="text-muted mb-4">{userInfo.email}</p>

              {/* Sección de Detalles */}
              <div className={styles.infoSection}>
                <div className="mb-3">
                  <div className={styles.label}>ID de Usuario</div>
                  <div className={styles.value}>{userInfo.id || 'N/A'}</div>
                </div>
                
                <div>
                  <div className={styles.label}>Rol / Permisos</div>
                  <div className={styles.value}>
                    {userInfo.isAdmin ? 'Administrador' : 'Cliente'}
                  </div>
                </div>
              </div>

              <Button variant="outline-danger" className="w-100 py-2" onClick={handleLogout}>
                Cerrar Sesión
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfileScreen;