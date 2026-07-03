import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  return (
    <>
      <h1 className={styles.title}>Dashboard de Administración</h1>
      <p className={styles.subtitle}>
        Bienvenido al panel de control. Aquí verás las estadísticas principales del negocio.
      </p>

      <Row>
        <Col md={4} className="mb-4">
          <Card className={styles.statCard}>
            <Card.Body>
              <h5 className={styles.statCardTitle}>Órdenes hoy</h5>
              <p className={styles.statCardValue}>$0.00</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className={styles.statCard}>
            <Card.Body>
              <h5 className={styles.statCardTitle}>Nuevos usuarios</h5>
              <p className={styles.statCardValue}>0</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className={styles.statCard}>
            <Card.Body>
              <h5 className={styles.statCardTitle}>Productos activos</h5>
              <p className={styles.statCardValue}>0</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className={styles.infoBox}>
        <p className={styles.infoBoxText}>
          El catálogo está listo para empezar a cargar productos reales desde categorías y productos.
        </p>
      </div>
    </>
  );
};

export default AdminDashboard;
