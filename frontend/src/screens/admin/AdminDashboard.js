import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  return (
    <>
      <h1 className={styles.title}>Dashboard de Administración</h1>
      <p className={styles.subtitle}>Bienvenido al Panel de Control. Aquí verás las estadísticas principales del negocio.</p>
      
      <Row>
        <Col md={4} className="mb-4">
          <Card className={styles.statCard}>
            <Card.Body>
              <h5 className={styles.statCardTitle}>Órdenes Hoy</h5>
              <p className={styles.statCardValue}>$12,450</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className={styles.statCard}>
            <Card.Body>
              <h5 className={styles.statCardTitle}>Nuevos Usuarios</h5>
              <p className={styles.statCardValue}>25</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className={styles.statCard}>
            <Card.Body>
              <h5 className={styles.statCardTitle}>Productos Activos</h5>
              <p className={styles.statCardValue}>145</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <div className={styles.infoBox}>
          <p className={styles.infoBoxText}>Esta es la vista de un administrador.</p>
      </div>
    </>
  );
};

export default AdminDashboard;
