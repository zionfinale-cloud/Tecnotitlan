import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css'; // Importamos la base de Bootstrap
import './index.css'; // Importamos nuestros estilos maestros
import App from './App';
import { Sentry } from './monitoring';

const loadInterfaceIcons = () => import('@fortawesome/fontawesome-free/css/all.min.css');
if (document.readyState === 'complete') window.setTimeout(loadInterfaceIcons, 0);
else window.addEventListener('load', loadInterfaceIcons, { once: true });

const container = document.getElementById('root');
// Usamos createRoot para React 18
const root = createRoot(container); 

root.render(
  <Sentry.ErrorBoundary fallback={<main style={{ padding: '2rem', fontFamily: 'sans-serif' }}><h1>No pudimos cargar esta pantalla</h1><p>El incidente fue registrado. Recarga la página o vuelve a intentarlo en unos minutos.</p></main>}>
    <React.StrictMode>
        <App />
    </React.StrictMode>
  </Sentry.ErrorBoundary>
);
