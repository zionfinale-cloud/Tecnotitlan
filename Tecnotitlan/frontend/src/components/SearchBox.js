import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
// Se importa el CSS Module en lugar de usar clases de Tailwind
import styles from './SearchBox.module.css';

const SearchBox = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const urlKeyword = queryParams.get('keyword') || '';

  const [keyword, setKeyword] = useState(urlKeyword);
  const debouncedKeyword = useDebounce(keyword, 500);
  const isSearching = keyword !== urlKeyword && keyword !== debouncedKeyword;

  // EFECTOS (Lógica de sincronización)
  useEffect(() => {
    if (keyword !== urlKeyword) {
      setKeyword(urlKeyword);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword]);

  useEffect(() => {
    if (debouncedKeyword === urlKeyword) {
      return;
    }

    const newParams = new URLSearchParams(location.search);

    if (debouncedKeyword.trim()) {
      newParams.set('keyword', debouncedKeyword.trim());
      newParams.set('page', '1');
      navigate(`/?${newParams.toString()}`);
    } else {
      newParams.delete('keyword');
      newParams.delete('page');
      navigate(`/?${newParams.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword, navigate]);
  
  const clearSearch = (e) => {
    e.preventDefault();
    setKeyword('');
    const newParams = new URLSearchParams(location.search);
    newParams.delete('keyword');
    newParams.delete('page');
    navigate(`/?${newParams.toString()}`);
  };

  const submitHandler = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      const newParams = new URLSearchParams(location.search);
      newParams.set('keyword', keyword.trim());
      newParams.set('page', '1');
      navigate(`/?${newParams.toString()}`);
    } else {
      clearSearch(e);
    }
  };

  return (
    // Se usa la clase del CSS Module para el formulario
    <form onSubmit={submitHandler} className={styles.searchForm} role="search">
      {/* Ícono de búsqueda (Izquierda) con su clase del CSS Module */}
      <i className={`fas fa-search ${styles.searchIcon}`}></i>

      <input
        type="text"
        name="q"
        onChange={(e) => setKeyword(e.target.value)}
        value={keyword}
        placeholder="Buscar productos..."
        // Se usa la clase del CSS Module para el input
        className={styles.searchInput}
        aria-label="Buscar productos"
        autoComplete="off"
      />

      {/* Botones de Acción (Derecha) */}
      {isSearching ? (
        <div className={styles.iconContainer}>
          <i className={`fas fa-spinner ${styles.spinnerIcon}`}></i>
        </div>
      ) : keyword && (
        <button type="button" className={`${styles.iconContainer} ${styles.clearButton}`} onClick={clearSearch} aria-label="Limpiar búsqueda">
          <i className="fas fa-times"></i>
        </button>
      )}
    </form>
  );
};

export default SearchBox;