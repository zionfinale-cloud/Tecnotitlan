🗺️ Mapeo Completo del Frontend (Dark Tecnotitlan)

Este documento lista todos los archivos que se han creado desde el inicio del proyecto. Úsalo como referencia para verificar rutas de importación y asegurar la sincronización de tu entorno local.

1. Configuración Raíz y Shell

Ruta del Archivo

Título del Archivo (Haz clic para abrir)

Propósito

[frontend/package.json](./frontend/package.json)

Configuración de Dependencias del Frontend

Dependencias y scripts de inicio.

frontend/src/index.js

[React Entry Point](./frontend/src/index.js)

Montaje de la aplicación React.

frontend/src/index.css

[Colores y Tipografía Maestros](./frontend/src/index.css)

Variables CSS de Dark Tecnotitlan (--brand-dark, --cta-color).

frontend/public/index.html

[index.html (Shell de Frontend)](./frontend/public/index.html)

Entrada principal, carga de Font Awesome y configuración del viewport.

frontend/src/App.js

App.js (Core con Contextos y Rutas)

[Central de enrutamiento y proveedores de contexto.](./frontend/src/App.js)

2. Contextos de Estado Global

Ruta del Archivo

Título del Archivo

Propósito

[frontend/src/context/AuthContext.js](./frontend/src/context/AuthContext.js)

Auth Context

Gestión de sesión de usuario (Login/Logout, userInfo, permisos).

[frontend/src/context/SettingsContext.js](./frontend/src/context/SettingsContext.js)

Settings Context

Carga y gestión de la configuración global de la tienda (color, nombre, logo).

[frontend/src/context/CartContext.js](./frontend/src/context/CartContext.js)

Cart Context (Módulo Fix)

Gestión del carrito de compras (cartItems, añadir/eliminar, persistencia local).

[frontend/src/context/LoadingContext.js](./frontend/src/context/LoadingContext.js)

Loading Context

Controla el estado de carga global (isLoading) a través de loadingService.js.

[frontend/src/context/ToastContext.js](./frontend/src/context/ToastContext.js)

Toast Context

Muestra notificaciones flotantes y temporales.

[frontend/src/context/NotificationContext.js](./frontend/src/context/NotificationContext.js)

Notification Context

Muestra alertas estáticas y persistentes (errores de API, etc.).

3. Utilidades, Hooks y Servicios

Ruta del Archivo

Título del Archivo

Propósito

[frontend/src/services/apiService.js](./frontend/src/services/apiService.js)

API Service Centralizado

Interceptor de Axios para inyectar JWT y manejar errores 401.

[frontend/src/utils/loadingService.js](./frontend/src/utils/loadingService.js)

Loading Service (Minúscula)

Lógica de suscripción para peticiones HTTP activas.

[frontend/src/hooks/useDebounce.js](./frontend/src/hooks/useDebounce.js)

useDebounce Hook

Retrasa el procesamiento de entradas de usuario (ej. búsqueda).

frontend/src/hooks/useProductFilters.js

[useProductFilters Hook](./frontend/src/hooks/useProductFilters.js)

Lógica de filtrado, paginación y mocks de productos para HomeScreen.

4. Componentes Reutilizables y Layout

Ruta del Archivo

Título del Archivo

Propósito

[frontend/src/components/Layout.js](./frontend/src/components/Layout.js)

Layout Limpio y Estable

Plantilla base (Header, Outlet, Footer, Overlays).

[frontend/src/components/Header.js](./frontend/src/components/Header.js)

Header Borde-a-Borde

Barra de navegación superior, diseño oscuro, lógica de usuario y carrito.

[frontend/src/components/Header.module.css](./frontend/src/components/Header.module.css)

Estilos para Header

Estilos CSS para el Header y el esqueleto de carga.

[frontend/src/components/HeaderSkeleton.js](./frontend/src/components/HeaderSkeleton.js)

HeaderSkeleton (Dark Match)

Placeholder de carga inicial para el Header.

[frontend/src/components/Footer.js](./frontend/src/components/Footer.js)

Footer Dark Mode

Pie de página oscuro, utiliza SettingsContext.

[frontend/src/components/ProtectedRoute.js](./frontend/src/components/ProtectedRoute.js)

Ruta Protegida (Export Fix)

Componente que verifica autenticación y permisos de administrador.

[frontend/src/components/LoadingSpinner.js](./frontend/src/components/LoadingSpinner.js)

Componente LoadingSpinner

Spinner de carga centrado para pantallas.

[frontend/src/components/LoadingOverlay.js](./frontend/src/components/LoadingOverlay.js)

Componente LoadingOverlay

Capa de carga que cubre toda la pantalla.

[frontend/src/components/Message.js](./frontend/src/components/Message.js)

Componente Message

Alerta de Bootstrap para errores y éxito en contenido.

[frontend/src/components/Notification.js](./frontend/src/components/Notification.js)

Componente Notification

Alerta estática superior (usa NotificationContext).

[frontend/src/components/ToastNotification.js](./frontend/src/components/ToastNotification.js)

Componente ToastNotification

Alerta flotante inferior derecha (usa ToastContext y CartContext).

[frontend/src/components/SearchBox.js](./frontend/src/components/SearchBox.js)

SearchBox Componente

Barra de búsqueda con funcionalidad de debounce.

[frontend/src/components/Rating.js](./frontend/src/components/Rating.js)

Componente de Rating

Muestra estrellas de calificación.

[frontend/src/components/Paginate.js](./frontend/src/components/Paginate.js)

Componente de Paginación

Botones de paginación para la lista de productos.

[frontend/src/components/Product.js](./frontend/src/components/Product.js)

Tarjeta de Producto Premium

Tarjeta individual de producto para la cuadrícula.

[frontend/src/components/ProductList.js](./frontend/src/components/ProductList.js)

ProductList Componente

Contenedor de la cuadrícula de productos, maneja la carga y error.

[frontend/src/components/HeroSection.js](./frontend/src/components/HeroSection.js)

HeroSection JS (Dark Tecnotitlan)

Componente visual del Hero de la página principal.

[frontend/src/components/FilterSidebar.js](./frontend/src/components/FilterSidebar.js)

Sidebar de Filtros

Panel lateral de categorías y filtros.

[frontend/src/components/AdminLayout.js](./frontend/src/components/AdminLayout.js)

AdminLayout (Tailwind)

Estructura de navegación lateral del panel de administración.

5. Pantallas de Cliente (frontend/src/screens/)

Ruta del Archivo

Título del Archivo

Propósito

[frontend/src/screens/HomeScreen.js](./frontend/src/screens/HomeScreen.js)

Home Screen Principal

Página principal con diseño flotante (Hero oscuro, contenido claro).

[frontend/src/screens/ProductScreen.js](./frontend/src/screens/ProductScreen.js)

Product Screen

Pantalla de detalles de un producto específico.

[frontend/src/screens/CartScreen.js](./frontend/src/screens/CartScreen.js)

Cart Screen

Pantalla para ver, editar y eliminar artículos del carrito.

[frontend/src/screens/LoginScreen.js](./frontend/src/screens/LoginScreen.js)

Login Screen

Formulario de inicio de sesión.

[frontend/src/screens/RegisterScreen.js](./frontend/src/screens/RegisterScreen.js)

Register Screen

Formulario de registro de nuevo usuario.

[frontend/src/screens/ProfileScreen.js](./frontend/src/screens/ProfileScreen.js)

Client Profile Placeholder

Placeholder para la página de perfil del usuario.

[frontend/src/screens/ShippingScreen.js](./frontend/src/screens/ShippingScreen.js)

Client Shipping Placeholder

Placeholder para el paso 1 del checkout (Dirección de Envío).

[frontend/src/screens/PaymentScreen.js](./frontend/src/screens/PaymentScreen.js)

Client Payment Placeholder

Placeholder para el paso 2 del checkout (Método de Pago).

[frontend/src/screens/PlaceOrderScreen.js](./frontend/src/screens/PlaceOrderScreen.js)

Client Place Order Placeholder

Placeholder para el paso 3 del checkout (Resumen y Confirmación).

[frontend/src/screens/OrderScreen.js](./frontend/src/screens/OrderScreen.js)

Client Order Details Placeholder

Placeholder para ver el detalle de un pedido específico.

6. Pantallas de Administración (frontend/src/screens/admin/)

Ruta del Archivo

Título del Archivo

Propósito

[frontend/src/screens/admin/AdminDashboard.js](./frontend/src/screens/admin/AdminDashboard.js)

Admin Dashboard Placeholder

Vista principal de estadísticas.

[frontend/src/screens/admin/ProductListScreen.js](./frontend/src/screens/admin/ProductListScreen.js)

Admin Product List Placeholder

CRUD de productos.

[frontend/src/screens/admin/OrderListScreen.js](./frontend/src/screens/admin/OrderListScreen.js)

Admin Order List Placeholder

Gestión de pedidos.

[frontend/src/screens/admin/UserListScreen.js](./frontend/src/screens/admin/UserListScreen.js)

Admin User List Placeholder

Gestión de usuarios y roles.

[frontend/src/screens/admin/ProductEditScreen.js](./frontend/src/screens/admin/ProductEditScreen.js)

Admin Product Edit Placeholder

Formulario de edición de producto.

[frontend/src/screens/admin/UserEditScreen.js](./frontend/src/screens/admin/UserEditScreen.js)

Admin User Edit Placeholder

Formulario de edición de usuario y permisos.

[frontend/src/screens/admin/CategoryListScreen.js](./frontend/src/screens/admin/CategoryListScreen.js)

Admin Category List Placeholder

CRUD de categorías.

[frontend/src/screens/admin/RoleListScreen.js](./frontend/src/screens/admin/RoleListScreen.js)

Admin Role List Placeholder

Gestión de roles y permisos (RBAC).

[frontend/src/screens/admin/SettingsPage.js](./frontend/src/screens/admin/SettingsPage.js)

Admin Settings Layout Placeholder

Layout y navegación de la configuración del sistema.

[frontend/src/screens/admin/WhatsappSettingsScreen.js](./frontend/src/screens/admin/WhatsappSettingsScreen.js)

Admin Whatsapp Settings Placeholder

Configuración de la integración con WhatsApp.