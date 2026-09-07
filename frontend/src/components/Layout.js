import React from 'react';
import { Outlet } from 'react-router-dom';

import Header from './Header'; 
import Footer from './Footer';
import Notification from './Notification';
import ToastNotification from './ToastNotification';
import TecatlChatWidget from './TecatlChatWidget';
import MobileStoreNav from './MobileStoreNav';
import styles from './Layout.module.css';

const Layout = () => {
  return (
    // Estructura flex para asegurar que el contenido esté pegado y se vea el fondo
    // CRÍTICO: Se cambia el fondo a uno oscuro para que coincida con el tema.
    <div className={styles.layout}>
      
      {/* 1. Header (Contiene el redondeo rounded-b-xl) */}
      <Header />
      <Notification />
      
      {/* 2. Contenido principal (donde se renderiza HomeScreen) */}
      {/* Se elimina el fondo blanco de 'main'. Ahora es transparente. */}
      <main className={styles.main}>
        <Outlet /> 
      </main>
      <Footer />
      <ToastNotification />
      <TecatlChatWidget />
      <MobileStoreNav />
    </div>
  );
};

export default Layout;
