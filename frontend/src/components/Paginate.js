import React from 'react';
import { Pagination } from 'react-bootstrap';

/**
 * Componente de paginación que se usa en ProductList.
 * Muestra los botones de página y maneja el cambio de página a través de setPage.
 * * @param {number} pages - Número total de páginas.
 * @param {number} page - Página actual activa.
 * @param {function} setPage - Función para cambiar la página (actualiza el estado del hook).
 */
const Paginate = ({ pages, page, setPage }) => {
    // Si solo hay una página, no mostramos nada.
    if (pages <= 1) {
        return null;
    }

    // Array para mapear los números de página (ej: [1, 2, 3, 4])
    const pageNumbers = [...Array(pages).keys()].map(x => x + 1);

    // Estilo para el botón activo (usa el color de acento)
    const activeItemStyle = {
        backgroundColor: 'var(--cta-color)',
        borderColor: 'var(--cta-color)',
        color: 'var(--brand-dark)', // Texto oscuro sobre el fondo neón
        fontWeight: 'bold',
    };

    // Estilo para los botones inactivos
    const itemStyle = {
        borderColor: '#E2E8F0',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--card-bg-color)',
        transition: 'all 0.2s',
    };

    return (
        <Pagination className="rounded-xl shadow-md border-0 p-2" style={{ backgroundColor: 'var(--card-bg-color)' }}>
            
            {/* Botón de 'Anterior' */}
            <Pagination.Prev 
                onClick={() => setPage(page - 1)} 
                disabled={page === 1}
                style={itemStyle}
            />

            {/* Renderizar los números de página */}
            {pageNumbers.map(x => (
                <Pagination.Item
                    key={x}
                    active={x === page}
                    onClick={() => setPage(x)}
                    style={x === page ? activeItemStyle : itemStyle}
                    className="rounded-lg mx-1 transition-all duration-200"
                >
                    {x}
                </Pagination.Item>
            ))}

            {/* Botón de 'Siguiente' */}
            <Pagination.Next 
                onClick={() => setPage(page + 1)} 
                disabled={page === pages}
                style={itemStyle}
            />

        </Pagination>
    );
};

export default Paginate;