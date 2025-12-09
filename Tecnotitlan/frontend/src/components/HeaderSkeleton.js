import React from 'react';
import { Container } from 'react-bootstrap'; 

const HeaderSkeleton = () => {
  return (
    // CRÍTICO: Usamos var(--brand-dark) para que el esqueleto se fusione con el Header
    <div className="w-full py-3 sticky top-0 z-50" style={{ backgroundColor: 'var(--brand-dark)' }}>
      <Container>
        <div className="d-flex justify-content-between align-items-center">
          {/* Skeleton Logo (Barra de carga larga) */}
          {/* Se mantiene rounded para simular el logo */}
          <div className="w-32 h-8 bg-white/10 rounded animate-pulse" />

          {/* Skeleton Buscador (Solo Desktop) */}
          <div className="d-none d-lg-block mx-auto w-1/2 max-w-lg">
            {/* CRÍTICO: Usamos rounded-full para que coincida con el SearchBox real */}
            <div className="w-full h-10 bg-white/10 rounded-full animate-pulse" />
          </div>

          {/* Skeleton Nav Items (Carrito y Usuario) */}
          <div className="d-flex align-items-center gap-4">
            {/* Carrito */}
            <div className="w-20 h-6 bg-white/10 rounded animate-pulse" />
            {/* Usuario */}
            <div className="w-24 h-6 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        
        {/* Barra de búsqueda (Solo Móvil) */}
        <div className="d-lg-none mt-3">
          {/* CRÍTICO: Usamos rounded-full para el móvil también */}
          <div className="w-full h-10 bg-white/10 rounded-full animate-pulse" />
        </div>
      </Container>
    </div>
  );
};

export default HeaderSkeleton;