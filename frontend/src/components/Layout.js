import React from 'react';
import { Outlet } from 'react-router-dom';

// SOLO importamos el Header
import Header from './Header'; 
// Se eliminan las importaciones de Footer, Notificaciones, etc., para aislar.

const Layout = () => {
  return (
    // Estructura flex para asegurar que el contenido esté pegado y se vea el fondo
    <div className="flex flex-col min-h-screen">
      
      {/* 1. Header (Contiene el redondeo rounded-b-xl) */}
      <Header />
      
      {/* 2. Contenido principal (donde se renderiza HomeScreen) */}
      {/* Usamos bg-white en main para hacer un contraste claro si el Hero no lo hace */}
      <main className="flex-grow bg-white"> 
        <Outlet /> 
      </main>
      
    </div>
  );
};

export default Layout;