import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css'; // Importamos la base de Bootstrap
import './index.css'; // Importamos nuestros estilos maestros
import App from './App';

const container = document.getElementById('root');
// Usamos createRoot para React 18
const root = createRoot(container); 

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);