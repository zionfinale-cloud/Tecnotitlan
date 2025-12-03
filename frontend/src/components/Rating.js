import React from 'react';

/**
 * Componente para mostrar la calificación por estrellas.
 * Usa Font Awesome (fas fa-star) para los iconos.
 */
const Rating = ({ value, text, color = 'var(--cta-color)' }) => {
  return (
    // Damos un estilo limpio y alineado al texto de la reseña
    <div className="d-flex align-items-center text-sm text-gray-500">
      {[1, 2, 3, 4, 5].map((index) => (
        <span key={index} className="mr-1">
          <i
            // El color se hereda de la variable CSS --cta-color por defecto
            style={{ color: color }}
            className={
              value >= index
                ? 'fas fa-star' // Estrella completa
                : value >= index - 0.5
                ? 'fas fa-star-half-alt' // Media estrella
                : 'far fa-star text-gray-300' // Estrella vacía
            }
          ></i>
        </span>
      ))}
      {/* Muestra el número de reseñas junto a las estrellas */}
      <span className="ms-2 text-xs text-gray-500">{text}</span>
    </div>
  );
};

export default Rating;