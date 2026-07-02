import React from 'react';
import { Outlet } from 'react-router-dom';

// SOLO importamos el Header
import Header from './Header'; 
import Footer from './Footer';
// Se eliminan las importaciones de Footer, Notificaciones, etc., para aislar.

const Layout = () => {
  return (
    // Estructura flex para asegurar que el contenido esté pegado y se vea el fondo
    // CRÍTICO: Se cambia el fondo a uno oscuro para que coincida con el tema.
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-slate-900">
      
      {/* 1. Header (Contiene el redondeo rounded-b-xl) */}
      <Header />
      
      {/* 2. Contenido principal (donde se renderiza HomeScreen) */}
      {/* Se elimina el fondo blanco de 'main'. Ahora es transparente. */}
      <main className="flex-grow"> 
        <Outlet /> 
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
