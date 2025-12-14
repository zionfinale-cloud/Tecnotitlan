import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import styles from './HeroSection.module.css'; 
// Asume que la imagen 'dronbg.png' ya está en /public/images/

function HeroSection() {
    // CRÍTICO: Carga la imagen de fondo desde la carpeta public de forma segura.
    const heroStyle = {
        // Asegúrate de que dronbg.png esté en la carpeta /public/images/
        backgroundImage: `url(${process.env.PUBLIC_URL}/images/dronbg.png)` 
    };

    return (
        // CLASES CRÍTICAS:
        // 1. Añadimos 'rounded-b-2xl' para el redondeo inferior grande.
        // 2. Usamos 'container-fluid' para que el fondo del Hero sea de borde a borde. Se elimina el redondeo.
        // Los estilos de padding y altura mínima se definen en HeroSection.module.css
        <div className={`${styles.hero} container-fluid`} style={heroStyle}> 
            {/* Contenido dentro de un Container para alinear el texto con el resto del sitio */}
            <Container> 
                <Row>
                    {/* Usamos Col md={7} para que el texto ocupe un espacio razonable y no choque con el dron */}
                    <Col md={7}> 
                        <div className={styles.heroContent}>
                            <h1 className={styles.heroTitle}>Tecnología con Raíces, Poder sin Límites.</h1>
                            <p className={styles.heroSubtitle}>Explora la Conexión.</p>
                            {/* El botón usa las clases de Bootstrap y las variables CSS del index.css */}
                            <a href="#products" className={`btn btn-primary ${styles.heroButton}`}>
                              Explora la Conexión
                            </a>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default HeroSection;