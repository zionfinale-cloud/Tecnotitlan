import React from 'react';
import { Outlet } from 'react-router-dom';

import Header from './Header'; 
import Footer from './Footer';
import Notification from './Notification';
import ToastNotification from './ToastNotification';
import TecatlChatWidget from './TecatlChatWidget';

const Layout = () => {
  return (
    // Estructura flex para asegurar que el contenido esté pegado y se vea el fondo
    // CRÍTICO: Se cambia el fondo a uno oscuro para que coincida con el tema.
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-slate-900">
      
      {/* 1. Header (Contiene el redondeo rounded-b-xl) */}
      <Header />
      <Notification />
      
      {/* 2. Contenido principal (donde se renderiza HomeScreen) */}
      {/* Se elimina el fondo blanco de 'main'. Ahora es transparente. */}
      <main className="flex-grow"> 
        <Outlet /> 
      </main>
      <Footer />
      <ToastNotification />
      <TecatlChatWidget />
    </div>
  );
};

export default Layout;
