import { useState, useEffect } from 'react';

/**
 * Hook personalizado para aplicar 'debounce' a un valor.
 * Retorna el valor solo después de que el usuario ha dejado de cambiarlo por el tiempo especificado.
 * @param {*} value - El valor a debouncar (ej: el texto del input)
 * @param {number} delay - El tiempo de espera en milisegundos
 * @returns {*} El valor debouncado
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Establece el valor debounced después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpia el timeout si el valor cambia antes de que expire el delay
    // o si el componente se desmonta.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Solo re-ejecuta si el valor o el delay cambian

  return debouncedValue;
}