import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

// Datos de navegación (Menú Lateral)
const navLinks = [
    { to: '/admin/dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard' },
    { to: '/admin/productlist', icon: 'fa-box-open', text: 'Productos' },
    { to: '/admin/orderlist', icon: 'fa-shipping-fast', text: 'Pedidos' },
    { to: '/admin/userlist', icon: 'fa-users', text: 'Usuarios' },
    { to: '/admin/categorylist', icon: 'fa-list-alt', text: 'Categorías' }, // Agregamos Categorías
    { to: '/admin/rolelist', icon: 'fa-lock', text: 'Roles' }, // Agregamos Roles/Permisos
    { to: '/admin/settings/page', icon: 'fa-cogs', text: 'Configuración' },
];

const AdminLayout = () => {
    return (
        // Fondo gris claro para el área del contenido principal
        <div className="flex min-h-screen bg-gray-100">
            {/* -----------------------
                BARRA LATERAL (SIDEBAR)
                Estilo Oscuro con acentos Neon
               ----------------------- */}
            <aside className="w-64 bg-[#1a202c] text-white flex-shrink-0 hidden md:block shadow-xl">
                <div className="p-6 sticky top-0">
                    <h2 className="text-2xl font-bold text-[#00A56E] mb-8 tracking-wide border-b border-gray-700 pb-4">
                        Panel Admin
                    </h2>
                    <nav>
                        <ul className="space-y-3">
                            {navLinks.map((item, index) => (
                                <li key={index}>
                                    <NavLink 
                                        to={item.to} 
                                        className={({ isActive }) => 
                                            `flex items-center p-3 rounded-lg transition-all duration-200 group no-underline
                                            ${isActive 
                                                ? 'bg-[#00A56E] text-white shadow-md translate-x-1' 
                                                : 'text-gray-400 hover:bg-gray-800 hover:text-white hover:translate-x-1'
                                            }`
                                        }
                                    >
                                        <div className="w-8 text-center">
                                            <i className={`fas ${item.icon} text-lg group-hover:scale-110 transition-transform`}></i>
                                        </div>
                                        <span className="font-medium text-sm">{item.text}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </aside>
            
            {/* -----------------------
                CONTENIDO PRINCIPAL
               ----------------------- */}
            <main className="flex-grow p-6 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Contenedor Blanco tipo Tarjeta para las páginas hijas */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[85vh]">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;