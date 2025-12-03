import React from 'react';
import { ListGroup } from 'react-bootstrap';
// Importamos los estilos del módulo (ya definidos en tu Canvas)
import styles from './FilterSidebar.module.css';

const FilterSidebar = ({ categories = [], selectedCategory, setSelectedCategory, handleClearFilters }) => {
  return (
    <div className={styles.sidebarContainer}>
      {/* Título elegante usando la clase .title del módulo */}
      <div className={styles.title}>Categorías</div>
      
      <ListGroup variant="flush" className={styles.listGroup}>
        {/* Opción "Todas" para resetear fácil */}
        <ListGroup.Item
            action
            className={`${styles.categoryItem} ${!selectedCategory ? styles.active : ''}`}
            onClick={() => handleClearFilters()}
        >
            Todas
        </ListGroup.Item>

        {/* Mapeo de Categorías */}
        {categories.map((category) => (
          <ListGroup.Item
            key={category.id}
            action
            // Aplicamos clase activa (.active) si coincide con la selección
            className={`${styles.categoryItem} ${category.name === selectedCategory ? styles.active : ''}`}
            onClick={() => setSelectedCategory(category.name)}
          >
            {category.name}
            
            {/* Indicador visual sutil si está activo */}
            {category.name === selectedCategory && (
                <i className="fas fa-chevron-right" style={{ fontSize: '0.7rem' }}></i>
            )}
          </ListGroup.Item>
        ))}
      </ListGroup>

      {/* Botón sutil para limpiar filtros solo si hay una selección activa */}
      {selectedCategory && (
          <button 
            className={styles.clearButton} 
            onClick={handleClearFilters}
          >
            <i className="fas fa-times me-1"></i> Borrar filtros
          </button>
      )}
    </div>
  );
};

export default FilterSidebar;