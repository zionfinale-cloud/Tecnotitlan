import React, { useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap'; 
// Componentes
import HeroSection from '../components/HeroSection';
import ProductList from '../components/ProductList';
import FilterSidebar from '../components/FilterSidebar';
// Hooks
import useProductFilters from '../hooks/useProductFilters';
// Estilos (CSS Puro)
import styles from './HomeScreen.module.css';

const HomeScreen = () => {
    // Inicializamos la lógica de filtros y productos desde el hook
    const {
        products, loading, error, pages, page, setPage,
        categories, selectedCategory, setSelectedCategory, handleClearFilters,
    } = useProductFilters(); 

    // Asegurar que la página siempre se cargue en la parte superior al cambiar de página
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [page]);

    // Estilo en línea para forzar el diseño redondeado y verde en la barra lateral
    const sidebarContainerStyle = {
        backgroundColor: '#FFFFFF', // Fondo blanco para contraste
        borderRadius: '20px',       // Bordes muy redondeados
        border: '2px solid var(--cta-color)', // Borde sólido de color verde neón
        padding: '1.5rem',          // Espaciado interno
        boxShadow: '0 4px 15px rgba(0, 220, 130, 0.15)', // Sombra suave verde
        position: 'sticky',
        top: '100px' // Mantenerlo pegajoso al hacer scroll
    };

    return (
        <>
            {/* 1. Hero Section (Compacto y Curvo) */}
            <HeroSection />

            {/* 2. Sección Principal */}
            <div className={styles.mainSection}>
                <Container>
                    <Row>
                        {/* --- COLUMNA IZQUIERDA: FILTROS --- */}
                        <Col lg={3} className="mb-4 mb-lg-0">
                            {/* Contenedor Sticky de Filtros con estilo estilo "redondeado y verde" */}
                            <div className={styles.filterContainer} style={sidebarContainerStyle}>
                                {/* AJUSTE: Eliminamos el título externo. 
                                    El componente FilterSidebar ahora se encarga de mostrar "Categorías". */}
                                
                                <FilterSidebar
                                    categories={categories}
                                    selectedCategory={selectedCategory}
                                    setSelectedCategory={setSelectedCategory}
                                    handleClearFilters={handleClearFilters}
                                />
                            </div>
                        </Col>

                        {/* --- COLUMNA DERECHA: PRODUCTOS --- */}
                        <Col lg={9}>
                            {/* Contenedor de la cuadrícula de productos */}
                            <div className={styles.productsContainer}>
                                <h2 className={styles.sectionTitle}>
                                    {selectedCategory ? `${selectedCategory}` : 'Nuevos Lanzamientos'}
                                </h2>
                                
                                <ProductList
                                    products={products}
                                    loading={loading}
                                    error={error}
                                    pages={pages}
                                    page={page}
                                    setPage={setPage}
                                />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </>
    );
};

export default HomeScreen;