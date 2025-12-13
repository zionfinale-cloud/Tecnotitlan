# Documentación Maestra del Proyecto: Tecnotitlan

Este documento es la guía técnica central y única fuente de verdad para el proyecto de e-commerce **Tecnotitlan**. Cubre la visión, arquitectura, guías de instalación, despliegue y hoja de ruta.

## 1. Visión General y Objetivos

- **Core Business:** Plataforma de e-commerce **"marca blanca"** y personalizable, diseñada para ser replicada en diferentes nichos de mercado (ej. tecnología, ropa, etc.). El sistema permite una personalización completa del frontend (nombre, logo, colores, slogan) a través del panel de administración.
- **Omnicanal:** Sistema centralizado que se integra con múltiples canales de venta, incluyendo redes sociales (Facebook, Instagram, TikTok Shop) y marketplaces (Mercado Libre, Amazon).
- **Comunicación Automatizada:**

    - **Bot de WhatsApp:** Conectado a través de `whatsapp-web.js` (baileys), gestionado y configurable desde el panel de administración para notificaciones de pedidos y atención al cliente.
    - **Chatbot Web:** Sincronizado con el sistema para ofrecer soporte en tiempo real en la tienda.
- **UI/UX:** Interfaz limpia, moderna y premium.

---

## 1.5. Principio de Diseño Fundamental: Plataforma "Marca Blanca" (White Label)

**Este es el principio más importante que guía el desarrollo del proyecto.**

El objetivo final no es construir una única tienda, sino una **plantilla de e-commerce reutilizable y 100% personalizable**. Cada componente y funcionalidad debe diseñarse con la premisa de que será adaptado para un nuevo proyecto de dropshipping con una identidad visual completamente diferente.

### Directrices Clave:

1.  **Todo es Configurable:** Elementos como el **logo, nombre de la página, colores primarios y secundarios, fuentes y slogans** no deben estar fijos en el código (`hardcoded`). Deben ser valores almacenados en la base de datos (en el modelo `Setting`) y gestionados desde el panel de administración.
2.  **Abstracción sobre Especificidad:** En lugar de crear un componente `HeaderTecnotitlan`, se crea un componente `Header` genérico que consume la configuración (logo, colores) desde un contexto global (`SettingsContext`).
3.  **Desarrollo Orientado a la Plantilla:** Antes de iniciar cualquier nueva funcionalidad, la primera pregunta debe ser: "¿Cómo hacemos esto editable desde el panel de admin?".

Este enfoque "White Label" es la clave para poder lanzar nuevas tiendas rápidamente, cambiando únicamente la configuración en la base de datos.

---

## 2. Estado Actual y Próximos Pasos (Continuidad del Proyecto)

**Última Actualización:** 04 de Diciembre, 2025

Esta sección sirve como punto de control para dar continuidad al desarrollo.

**Dominios:**
- www.tecnotitlan.com.mx
- tecnotitlan.shop
- tecnotitlan.online

### En qué nos quedamos:

1.  **Infraestructura Lista:** Se configuró la instancia de `Ubuntu-1` en AWS Lightsail con su IP estática (`3.148.78.23`).
2.  **Entorno Preparado:** Se instaló Docker, Docker Compose y Git en el servidor. Se solucionaron los problemas de conexión SSH y de memoria del servidor creando un archivo de `swap`.
3.  **Backend Desplegado (Casi Listo):** El backend de Node.js se clonó desde GitHub y se está ejecutando en un contenedor de Docker. Sin embargo, el contenedor se reinicia constantemente debido a un error.

### Problema Resuelto Recientemente:

*   **Problema:** No se podía establecer una conexión SSH con el servidor de Lightsail. El cliente web mostraba un error `UPSTREAM_ERROR [515]` y la terminal local daba `Permission denied`.
*   **Solución:** Se identificó que el problema estaba en la instancia del servidor, no en el cliente. Un **reinicio (reboot)** de la instancia desde el panel de Lightsail solucionó el problema y restauró la conectividad. Posteriormente, se solucionó un problema de autenticación con GitHub usando un **Token de Acceso Personal (PAT)** para clonar el repositorio.

### Problema Actual (Para Continuar Mañana):
*   **Error:** El contenedor del backend falla al arrancar con el error `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@prisma/client'`.
*   **Causa Probable:** El cliente de Prisma no se está generando durante el proceso de construcción de la imagen de Docker.

### Próximo Paso Inmediato:

**Objetivo:** Solucionar el error del cliente de Prisma y tener el backend 100% funcional.

**Acciones en Progreso:**
1.  **Preparación del Servidor:** Se ha establecido la conexión SSH con la instancia `Ubuntu-1`. Actualmente se están instalando las dependencias necesarias (Git, Docker, Docker Compose) y actualizando el sistema operativo. El proceso de `apt upgrade` está en curso.
2.  **Refactorización del Frontend:** Mientras esperamos que finalice la configuración del servidor, se está realizando una refactorización completa del frontend para eliminar toda dependencia de Tailwind CSS y alinear el 100% de los componentes con la arquitectura de CSS Modules. Se han creado y refactorizado componentes clave como `AdminLayout`, `SubMenu`, `SearchBox` y las pantallas del panel de administración (`AdminDashboard`, `ProductListScreen`, `UserListScreen`, `RoleListScreen`).

**Siguientes Pasos:**
1.  Una vez finalizada la instalación de dependencias en el servidor, se clonará el repositorio del backend.
2.  Se configurará el archivo `.env` con las variables de entorno de producción.
3.  Se construirá y ejecutará la imagen de Docker del backend.
4.  Se abrirá el puerto `5000` en el firewall de Lightsail para exponer la API.

**NOTA IMPORTANTE DE ESTRATEGIA DE DESARROLLO:**
Dado que el proyecto se encuentra en una fase inicial sin clientes ni productos en producción y el presupuesto es limitado, se adopta una estrategia de **"desarrollo en vivo"**.
Todo el trabajo, tanto de frontend como de backend, se realizará directamente sobre la infraestructura de producción de bajo costo (Render, Lightsail, Supabase).

**Objetivos de esta estrategia:**
1.  **Eliminar Discrepancias:** Evitar por completo los problemas de configuración y comportamiento que surgen al migrar de `localhost` a un entorno en vivo.
2.  **Eficiencia de Costos:** Utilizar la arquitectura de despliegue final desde el día uno, optimizando el uso del presupuesto.
3.  **Preparación para Inversión:** Tener una plataforma 100% funcional y demostrable en línea en todo momento, lista para ser presentada a potenciales inversores y para el lanzamiento inmediato una vez se asegure la financiación.



## 2. Pila Tecnológica

- **Backend:** Node.js, Express.js
- **Base de Datos:** PostgreSQL con **Prisma** (ORM moderno y type-safe)
- **Frontend:** React.js (Create React App)
- **Autenticación:** JSON Web Tokens (JWT). Sesiones de Express para flujos OAuth 2.0 con **PKCE** (Proof Key for Code Exchange) para integraciones como Mercado Libre.
- **Estilos:** **CSS Modules** y CSS plano. Se utilizan variables CSS globales para el theming. `react-bootstrap` se usa para componentes estructurales como `Container` y `Grid`, pero los estilos finos son personalizados.
- **Peticiones API:** Axios
- **Pruebas (Backend):** Jest, Supertest.
- **Pruebas (Frontend):** React Testing Library, Jest
- **Automatización:** n8n (self-hosted con Docker).
- **Contenerización:** Docker, Docker Compose.

---
> **⚠️ NOTA DE ARQUITECTURA (ACTUALIZACIÓN CRÍTICA):**
> 
> El frontend del proyecto ha sido completamente reconstruido. El backend actual es una herencia de un proyecto anterior y debe ser considerado únicamente como una **referencia conceptual**.
> 
> **No se realizará ninguna migración de código.** El backend se desarrollará desde cero siguiendo las especificaciones de este documento.
> 
> Esto incluye la base de datos. El `schema.prisma` existente servirá como referencia, pero la base de datos en Supabase se construirá desde cero con nuevas migraciones (`npx prisma migrate dev`). No se migrará ningún dato del entorno anterior.
> 
> Quedan **completamente descartados** para este proyecto:
> - **Mongoose y MongoDB:** La única tecnología de base de datos aprobada es **PostgreSQL con Prisma**, gestionada a través de Supabase.
> - **Tailwind CSS:** El frontend utilizará exclusivamente **CSS Modules** y CSS plano para los estilos.

---

## 3. Arquitectura y Decisiones Clave
- **Estructura PERN (PostgreSQL, Express, React, Node):** Se adopta una pila PERN para aprovechar la robustez de las bases de datos relacionales y el ecosistema moderno de Prisma.
- **API Centralizada (`apiService.js`):** Un único punto de entrada para todas las peticiones del frontend, utilizando interceptores de Axios para:
    - Adjuntar automáticamente tokens de autenticación.
    - Estandarizar el manejo de respuestas y errores.
    - Gestionar la expiración de sesión de forma global.
- **Autorización RBAC Flexible:** El acceso a rutas protegidas (ej. el panel de admin) se controla mediante permisos (`access:admin_panel`) en lugar de roles fijos, permitiendo una gestión de acceso más granular y escalable a través del `permissionMiddleware.js`.
- **Estilos con CSS Modules:** Se adoptó un enfoque de estilos encapsulados por componente para evitar conflictos de clases y mejorar la mantenibilidad. Las variables CSS globales (`:root` en `index.css`) permiten una personalización centralizada del tema.
- **Hooks Personalizados (`use...`):** La lógica de estado y las llamadas a API se abstraen en hooks reutilizables (`useFormValidation`, `useProductFilters`, `useCategoryManager`, `useProductForm`), centralizando la lógica compleja y haciendo los componentes más limpios y declarativos.
- **Lógica de Precios Segura:** El cálculo de precios y totales se realiza exclusivamente en el backend (`orderController.js`) para prevenir manipulaciones desde el cliente.
- **Transacciones Atómicas en la Base de Datos:** Se utilizan las **transacciones interactivas de Prisma** (`$transaction`) para garantizar que operaciones complejas (como crear un pedido y descontar stock) se completen con éxito o fallen juntas, manteniendo la consistencia de los datos.
- **Componentes Modulares y Reutilizables:** Se ha adoptado un enfoque de componentización para la UI. La lógica de la interfaz se divide en componentes pequeños y enfocados, como `ProductGrid.js` (para mostrar productos en una cuadrícula) y `SmartwatchShowcase.js` (una sección destacada configurable), lo que mejora la legibilidad y facilita la reutilización de código.
- **Estrategia de Subida de Archivos Flexible:** El sistema de subida de imágenes (`uploadController.js`) es dinámico y configurable mediante una variable de entorno (`UPLOAD_STRATEGY`), permitiendo cambiar entre almacenamiento local y Cloudinary sin modificar el código.
- **Estandarización de Respuestas API:** Todas las respuestas del backend siguen un formato consistente (`{ status: 'success', data: {...} }` o `{ status: 'error', message: '...' }`), lo que simplifica la lógica del frontend.
- **Seguridad del Backend:** Se implementan medidas de seguridad estándar como `helmet` para cabeceras HTTP, `cors` para control de origen y `express-rate-limit` para prevenir ataques de fuerza bruta en endpoints de autenticación.
- **Sistema de Configuración Dinámica:** La aplicación carga su configuración (claves de API, nombres, etc.) desde la base de datos al arrancar (`configService.js`). Esto permite a los administradores modificar el comportamiento y las integraciones (PayPal, Meli, WhatsApp) a través del panel de administración (`/admin/settings/*`) sin necesidad de redesplegar el código.
- **Archivado Lógico (Soft Delete):** Los productos no se eliminan directamente, sino que se marcan como archivados (`isArchived: true`). Esto permite restaurarlos en el futuro y mantiene la integridad de los datos en pedidos antiguos. Existe una opción para la eliminación permanente.
    - **Generación Automática de SKU:** Para evitar errores manuales y estandarizar el catálogo, los SKUs de los productos se generan automáticamente en el backend (`productController.js`) al momento de la creación, combinando un prefijo de categoría con un número secuencial (`TEC-SMARTWATCH-0001`).
- **Layout de Administración Centralizado (`AdminLayout.js`):** Toda la estructura del panel de administración (barra lateral, submenús) se gestiona en un único componente, facilitando la adición de nuevas secciones.

---

## 4. Estructura de Módulos y Estado Actual

### 4.1. Backend (Checklist de Progreso)

A continuación se detalla el estado de cada módulo del backend.

- **Usuarios y Autenticación**
    - ✅ **Modelos:** `User`, `Role`, `Permission` definidos en `schema.prisma`.
    - ✅ **Autenticación:** Registro, login y generación de JWT.
    - ✅ **Gestión de Perfil:** Los usuarios pueden ver y actualizar su propia información.
    - ✅ **CRUD de Admin:** Gestión completa de usuarios (crear, leer, actualizar, eliminar) para administradores.
    - ✅ **Autorización:** Middlewares `protect` (token) y `checkPermission` (RBAC) para proteger rutas.

- **Productos y Catálogo**
    - ✅ **Modelos:** `Product`, `Category`, `Review` definidos en `schema.prisma`.
    - ✅ **CRUD Completo:** Creación, lectura, actualización y eliminación de productos.
    - ✅ **Funciones Avanzadas:** Archivado lógico (soft-delete), gestión de stock y generación automática de SKU.
    - ✅ **Categorías:** Endpoints para obtener categorías en formato de árbol (jerárquico).
    - ✅ **Reseñas:** Sistema para que los usuarios dejen y vean reseñas de productos.

- **Pedidos y Checkout**
    - ✅ **Modelos:** `Order`, `OrderItem` definidos en `schema.prisma`.
    - ✅ **Creación de Pedidos:** Lógica transaccional para crear el pedido y descontar el stock de forma atómica.
    - ✅ **Historial de Pedidos:** Endpoints para que los usuarios vean sus pedidos y los administradores vean todos.
    - ✅ **Gestión de Estados:** Lógica para actualizar el estado de los pedidos (pagado, enviado, entregado).

- **Roles y Permisos (RBAC)**
    - ✅ **Modelos:** `Role`, `Permission` y tablas de unión.
    - ✅ **Seeding:** Creación automática del `SUPER_ADMIN` y permisos base al iniciar la BD.
    - ✅ **Gestión desde Admin:** Endpoints y UI para crear/editar roles y asignar permisos.

- **Reportes**
    - ✅ **Endpoints de Reportes:** Generación de datos para ventas, ganancias y productos más vendidos.

- **Integraciones**
    - ✅ **Pasarelas de Pago:** Lógica para procesar pagos con Stripe y PayPal.
    - ✅ **Notificaciones:** Conexión con WhatsApp para notificar sobre nuevos pedidos.
    - 🔄 **Marketplaces:** Lógica de sincronización con Mercado Libre y Amazon.

- **Configuración del Sistema**
    - ✅ **Modelos:** `Setting` para almacenar configuraciones dinámicas.
    - ✅ **Endpoints:** API para leer y actualizar configuraciones desde el panel de admin.
    - ✅ **Caché de Configuración:** `configService.js` para optimizar el acceso a las configuraciones.

### 4.2. Frontend (Funcional y Refactorizado)

> **Nota de Refactorización (En Progreso):** Se está llevando a cabo una migración completa para eliminar Tailwind CSS. Todos los componentes nuevos y existentes se están adaptando para usar exclusivamente **CSS Modules**, siguiendo la arquitectura definida.

- **UI/UX (Experiencia de Usuario):**
    - **Navegación de Catálogo:** La página de inicio (`HomeScreen.js`) ha sido enriquecida con un carrusel de productos top y una sección de productos destacados (`SmartwatchShowcase.js`). El buscador (`SearchBox.js`) ahora es automático (con debounce) y cuenta con una interfaz más limpia para una experiencia de búsqueda fluida.
    - **Detalle de Producto:** Página rediseñada con galería de imágenes interactiva (zoom/lightbox) y layout profesional.
    - **Feedback Visual:** Notificaciones "toast", animaciones en el carrito y estados de carga claros en toda la aplicación.    
    - **Componentes:** `Rating`, `Notification`, `Carousel`, `OrderTable` y otros han sido optimizados y estilizados con CSS Modules para encajar en el nuevo diseño "Dark Tecnotitlán".
- **Lógica de Cliente:**
    - **Autenticación:** `AuthContext` gestiona el estado del usuario en toda la app.
    - **Carrito de Compras:** `CartContext` maneja la lógica del carrito de forma robusta.
    - **Manejo de Sesión Global:** El interceptor de `apiService.js` detecta automáticamente los errores `401` (sesión expirada). Al ocurrir uno, limpia el `localStorage` y redirige forzosamente al usuario a la página de login, garantizando una limpieza de estado completa y segura.
    - **Checkout:** Flujo completo desde la dirección de envío hasta la selección del método de pago (PayPal, Stripe) y la creación del pedido.
- **Perfil de Usuario:** Los usuarios pueden ver y actualizar su información y consultar su historial de pedidos. Todos los formularios (Login, Registro, Perfil, Envío) han sido refactorizados para usar el hook central `useFormValidation`.
- **Panel de Administración:**
    - **Layout:** `AdminLayout.js` y `SubMenu.js` controlan la navegación y la estructura del panel.
    - **CRUD de Productos:** Formularios para crear y editar productos, con subida de imágenes, gestión de stock, características dinámicas y vinculación con Mercado Libre.
    - **Gestión de Pedidos:** Listado de todos los pedidos con filtros y capacidad para actualizar su estado.
    - **Gestión de Categorías:** Interfaz para administrar categorías y subcategorías.
    - **Gestión de Usuarios:** Interfaz para listar, editar (nombre, email, rol) y eliminar usuarios.
    - **Gestión de Roles y Permisos:** Interfaz para crear, editar y eliminar roles, asignando permisos específicos.
    - **Reportes:** Pantallas dedicadas para visualizar reportes de ventas, ganancias y productos más vendidos.
    - **Configuración:** Se han añadido pantallas dedicadas para gestionar la apariencia (`PageSettingsScreen.js`), integraciones (`MercadoLibreSettingsScreen.js`, `PaypalSettingsScreen.js`) y notificaciones (`NotificationSettingsScreen.js`).

---

## 5. Estructura de Archivos del Proyecto

El proyecto está organizado en un monorepo con dos componentes principales: `backend` y `frontend`.

tecnotitlan/ ├── .github/workflows/ # Workflows de CI/CD con GitHub Actions │ └── backend-ci.yml ├── backend/ │ ├── prisma/ # Directorio de Prisma │ │ ├── schema.prisma # Definición de modelos y conexión a la BD │ │ └── migrations/ # Migraciones de la base de datos generadas │ └── src/ │ ├── controllers/ # Lógica de negocio (ahora usarán Prisma Client) │ ├── routes/ # Definición de endpoints de la API │ ├── services/ # Lógica de servicios (WhatsApp, etc.) │ ├── middleware/ # Middlewares de Express (auth, errores) │ ├── config/ # Configuración (cliente de Prisma) │ └── index.js # Punto de entrada del servidor Express ├── frontend/ # Aplicación React (Create React App) │ └── src/ ├── scripts/ # Scripts de utilidad (seeding con Prisma) ├── .env # Variables de entorno (local) ├── docker-compose.yml # Orquestación de servicios locales (Postgres, n8n) └── Dockerfile # Receta para construir la imagen del backend


---

## 6. Referencia de Rutas de Archivos

Para facilitar la navegación y el análisis futuro del código, a continuación se listan las rutas de los archivos más relevantes del proyecto.

### 6.1. Backend (`/backend`)

-   **Punto de Entrada:** `d:/Tecnotitlan/backend/src/index.js`
-   **Base de Datos (Prisma):**
-   `d:/Tecnotitlan/backend/prisma/schema.prisma`: Definición de todos los modelos de datos.
-   `d:/Tecnotitlan/backend/prisma/seed.js`: Script para poblar la base de datos inicial.
-   **Controladores:**
-   `d:/Tecnotitlan/backend/src/controllers/userController.js`
-   `d:/Tecnotitlan/backend/src/controllers/productController.js`
-   `d:/Tecnotitlan/backend/src/controllers/orderController.js`
-   `d:/Tecnotitlan/backend/src/controllers/categoryController.js`
-   `d:/Tecnotitlan/backend/src/controllers/reportController.js`
-   `d:/Tecnotitlan/backend/src/controllers/settingController.js`
-   `d:/Tecnotitlan/backend/src/controllers/mercadoLibreController.js`
-   `d:/Tecnotitlan/backend/src/controllers/roleController.js`
-   **Rutas (Endpoints):**
-   `d:/Tecnotitlan/backend/src/routes/userRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/productRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/orderRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/categoryRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/reportRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/settingRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/mercadoLibreRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/uploadRoutes.js`
-   `d:/Tecnotitlan/backend/src/routes/roleRoutes.js`
-   **Middlewares:**
-   `d:/Tecnotitlan/backend/src/middleware/authMiddleware.js`
-   `d:/Tecnotitlan/backend/src/middleware/permissionMiddleware.js`
-   `d:/Tecnotitlan/backend/src/middleware/validationMiddleware.js`
-   `d:/Tecnotitlan/backend/src/middleware/errorMiddleware.js`
-   **Servicios:**
-   `d:/Tecnotitlan/backend/src/services/whatsappService.js`
-   `d:/Tecnotitlan/backend/src/services/configService.js`
-   `d:/Tecnotitlan/backend/src/services/mercadoLibreService.js`

### 6.2. Frontend (`/frontend`)

-   **Punto de Entrada y Configuración:**
-   `d:/Tecnotitlan/frontend/src/index.js`: Renderiza la aplicación React.
-   `d:/Tecnotitlan/frontend/src/App.js`: Componente raíz con el enrutador principal.
-   **Servicios:**
-   `d:/Tecnotitlan/frontend/src/services/apiService.js`: Cliente Axios centralizado con interceptores.
-   **Contexto (Estado Global):**
-   `d:/Tecnotitlan/frontend/src/context/AuthContext.js`: Estado de autenticación del usuario.
-   `d:/Tecnotitlan/frontend/src/context/CartContext.js`
-   `d:/Tecnotitlan/frontend/src/context/SettingsContext.js`
-   `d:/Tecnotitlan/frontend/src/context/LoadingContext.js`
-   `d:/Tecnotitlan/frontend/src/context/NotificationContext.js`
-   `d:/Tecnotitlan/frontend/src/context/ToastContext.js`
-   **Hooks Personalizados (`/frontend/src/hooks`):**
-   `d:/Tecnotitlan/frontend/src/hooks/useFormValidation.js`, `useProductFilters.js`, `useCategoryManager.js`, `useProductForm.js`, `useDashboardStats.js`, `useApi.js`, `useConfirmation.js`, `useLocalStorage.js`, `useOrderFilters.js`, `usePageTitle.js`, `useProductDetail.js`, `useReports.js`.
-   **Componentes Reutilizables (`/frontend/src/components`):**
-   `d:/Tecnotitlan/frontend/src/components/ProtectedRoute.js`, `Header.js`, `Footer.js`, `LoadingSpinner.js`, `Notification.js`, `SessionManager.js`, `ProductGrid.js`, `SmartwatchShowcase.js`, `AddToCartNotification.js`, `Breadcrumb.js`, `CheckoutSteps.js`, `FilterControls.js`, `FormContainer.js`, `OrderTable.js`, `Product.js`, `ProductCardSkeleton.js`, `ProductTable.js`, `RegisterForm.js`, `SearchBox.js`, `StripeCheckoutForm.js`.
-   **Páginas de Cliente y Admin (`/frontend/src/pages`):**
    -   **Cliente:** `HomeScreen.js`, `ProductDetailScreen.js`, `CartScreen.js`, `LoginScreen.js`, `ProfileScreen.js`.
    -   **Panel de Administración:**
-   `d:/Tecnotitlan/frontend/src/pages/admin/AdminLayout.js`: Layout principal del panel.
-   `d:/Tecnotitlan/frontend/src/pages/admin/SubMenu.js`
-   `/admin/dashboard`: `d:/Tecnotitlan/frontend/src/pages/admin/AdminDashboard.js`
-   `/admin/productlist`: `d:/Tecnotitlan/frontend/src/pages/admin/ProductListScreen.js`
-   `/admin/products/create`: `d:/Tecnotitlan/frontend/src/pages/admin/ProductCreateScreen.js`
-   `/admin/products/edit/:sku`: `d:/Tecnotitlan/frontend/src/pages/admin/ProductEditScreen.js`
-   `/admin/orderlist`: `d:/Tecnotitlan/frontend/src/pages/admin/OrderListScreen.js`
-   `/admin/categories`: `d:/Tecnotitlan/frontend/src/pages/admin/CategoryListScreen.js`
-   `/admin/userlist`: `d:/Tecnotitlan/frontend/src/pages/admin/UserListScreen.js`
-   `/admin/user/:id/edit`: `d:/Tecnotitlan/frontend/src/pages/admin/UserEditScreen.js`
-   `/admin/roles`: `d:/Tecnotitlan/frontend/src/pages/admin/RoleListScreen.js` (Para listar roles)
-   `/admin/role/:id/edit`: `d:/Tecnotitlan/frontend/src/pages/admin/RoleEditScreen.js` (Para crear/editar roles)
        -   **Reportes (Submenú):**
-   `/admin/sales`: `d:/Tecnotitlan/frontend/src/pages/admin/SalesSummaryScreen.js`
-   `/admin/profit`: `d:/Tecnotitlan/frontend/src/pages/admin/ProfitReportScreen.js`
-   `/admin/topselling`: `d:/Tecnotitlan/frontend/src/pages/admin/TopSellingProductsScreen.js`
        -   **Configuración (Submenú):**
-   `/admin/settings/page`: `d:/Tecnotitlan/frontend/src/pages/admin/PageSettingsScreen.js`
-   `/admin/integrations/mercadolibre`: `d:/Tecnotitlan/frontend/src/pages/admin/MercadoLibreSettingsScreen.js`
-   `/admin/integrations/paypal`: `d:/Tecnotitlan/frontend/src/pages/admin/PaypalSettingsScreen.js`
-   `/admin/integrations/notifications`: `d:/Tecnotitlan/frontend/src/pages/admin/NotificationSettingsScreen.js`
-   `/admin/integrations/whatsapp`: `d:/Tecnotitlan/frontend/src/pages/admin/WhatsappSettingsScreen.js`
-   **Otras:** `d:/Tecnotitlan/frontend/src/pages/admin/InventoryScreen.js`, `d:/Tecnotitlan/frontend/src/pages/admin/TestOrderCreationScreen.js`
### 6.3. Pruebas, CI/CD y Documentación
-   **Utilidades de Prueba:**
-   `d:/Tecnotitlan/frontend/src/test-utils/renderWithProviders.js`: Helper para renderizar componentes con sus contextos mockeados.
-   **Pruebas E2E (Cypress):**
    - `d:/Tecnotitlan/frontend/cypress/e2e/auth/login.cy.js`: Prueba el flujo de inicio de sesión del administrador.
    - `d:/Tecnotitlan/frontend/cypress/e2e/checkout.cy.js`: Prueba el flujo de compra completo, desde añadir un producto al carrito hasta la confirmación del pedido.
-   **CI/CD:**
    -   `.github/workflows/backend-ci.yml`: Workflow de GitHub Actions para pruebas del backend.
-   **Raíz del Proyecto:**
-   `package.json`: Dependencias y scripts del backend.
-   `frontend/package.json`: Dependencias y scripts del frontend.
-   `.env`: Variables de entorno (local, no versionado).
-   `d:/Tecnotitlan/README.md`: Documentación general del proyecto.
-   `d:/Tecnotitlan/mapeo_Tecnotitlan.md`: Este mismo documento.
-   `d:/Tecnotitlan/docker-compose.yml`: Orquestación de servicios locales (Postgres, n8n).

---

## 7. Guía de Instalación y Despliegue

### 7.1. Instalación en Entorno Local

Sigue estos pasos para configurar y ejecutar el proyecto en tu máquina.

#### Prerrequisitos
- Node.js (v18 o superior)
- Docker y Docker Compose
- Git

#### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/zionfinale-cloud/Tecnotitlan.git
    cd tecnotitlan # Asegúrate de que la carpeta del proyecto se llame así
    ```

2.  **Instalar dependencias:**
    Desde la raíz, instala las dependencias del backend y del frontend.
    ```bash
    # Nota: El flag --force es necesario temporalmente para resolver conflictos de dependencias.
    npm install --force
    cd frontend && npm install && cd ..
    ```

3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la raíz y añade las siguientes variables:
    ```env
    # CONFIGURACIÓN GENERAL
    NODE_ENV=development
    PORT=5000
    JWT_SECRET=tu_secreto_super_secreto_aqui
    
    # =================================
    # BASE DE DATOS (PostgreSQL)
    # =================================
    # Usar la base de datos de Supabase (recomendado para un entorno de desarrollo consistente)
    DATABASE_URL="postgresql://postgres.ecfbrxohxvvpwrhqzpwk:ze200785@aws-1-us-east-1.pooler.supabase.com:6543/postgres" # URL con Pooler para la app (producción/desarrollo)
    DIRECT_URL="postgresql://postgres:ze200785@db.ecfbrxohxvvpwrhqzpwk.supabase.co:5432/postgres" # URL directa para migraciones de Prisma
    
    # =================================
    # SUBIDA DE ARCHIVOS ('local' o 'cloudinary')
    # =================================
    UPLOAD_STRATEGY=local
    # Si usas Cloudinary, completa estas variables:
    # CLOUDINARY_CLOUD_NAME=
    # CLOUDINARY_API_KEY=
    # CLOUDINARY_API_SECRET=
    
    # =================================
    # PASARELAS DE PAGO
    # =================================
    PAYPAL_CLIENT_ID=tu_client_id_de_paypal
    PAYPAL_FEE_RATE=0.045 # Comisión porcentual (ej. 4.5%)
    
    STRIPE_SECRET_KEY=tu_sk_de_stripe
    STRIPE_FEE_RATE=0.036 # Comisión porcentual (ej. 3.6%)
    STRIPE_FEE_FIXED=3 # Comisión fija (ej. 3 MXN)

    # =================================
    # INTEGRACIONES
    # =================================
    MERCADOLIBRE_APP_ID=tu_app_id_de_meli
    MERCADOLIBRE_CLIENT_SECRET=tu_client_secret_de_meli
    MERCADOLIBRE_REDIRECT_URI=http://localhost:3000/admin/settings/mercado-libre/callback
    ```

4.  **Preparar la Base de Datos (Migraciones y Seeding):**
    Estos comandos crearán la estructura de tu base de datos y la llenarán con datos iniciales.
    
    ```bash
    # 1. Aplicar migraciones existentes para crear las tablas
    npx prisma migrate deploy
    
    # 2. (Opcional pero recomendado) Insertar los datos iniciales (admin, roles, etc.)
    npm run seed:import
    ```
    *Nota: Para eliminar todos los datos de la base de datos, puedes usar `npm run seed:destroy`.*

4.  **Ejecutar la aplicación:**
    Puedes ejecutar el backend y el frontend simultáneamente desde la raíz.
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:3000` y la API en `http://localhost:5000`.

### 7.2. Scripts Disponibles

- `npm run dev`: Ejecuta backend y frontend simultáneamente.
- `npm run server`: Inicia solo el servidor backend.
- `npm run client`: Inicia solo la aplicación de React.
- `npm run test:backend`: Ejecuta las pruebas del backend.
- `npm run seed:import`: Puebla la base de datos con datos de prueba.
- `npm run seed:destroy`: Elimina los datos de la base de datos.

### 7.3. Arquitectura de Despliegue (Estrategia "Free-to-Paid")

El proyecto sigue una filosofía de bajo costo inicial, alineando la inversión con el crecimiento.

-   **Base de Datos (PostgreSQL):**
    -   **Fase Gratuita:** **Supabase** (Free Tier, 500MB).
    -   **Fase de Pago:** Escalar a un plan Pro cuando se supere el límite.
-   **Frontend (Tienda Web):**
    -   **Fase Gratuita:** **Render** o **Vercel** (Free Tier), usando **Uptime Robot** para evitar que el servicio se "duerma".
    -   **Fase de Pago:** Escalar solo si la latencia se vuelve un problema.

-   **Backend y n8n (Automatización):**
    -   **Fase de Pago (Bajo Costo):** Ambos servicios se ejecutan 24/7 en un **VPS de ~$5 USD/mes** (ej. AWS Lightsail) usando Docker.

-   **Servicios API (WhatsApp, Gemini):**
    -   **Fase Gratuita:** Aprovechar las capas gratuitas de las APIs.
    -   **Fase de Pago:** Modelo **Pay-As-You-Go** al superar los límites.


### 7.3.1. Guía de Despliegue en Producción (Frontend en Render)

El frontend, al ser una aplicación de React (Create React App), se despliega como un **Sitio Estático**.

1.  **Crear Nuevo Servicio en Render:**
    -   Ir al Dashboard y seleccionar **New +** > **Static Site**.
    -   Conectar el repositorio de GitHub.

2.  **Configuración del Servicio:**
    -   **Name:** `tecnotitlan-frontend` (o similar).
    -   **Root Directory:** `frontend` (Importante para monorepo).
    -   **Build Command:** `npm install && npm run build`
    -   **Publish Directory:** `build` (Esta es la carpeta que genera el build).
    -   **Environment Variables:**
        -   `REACT_APP_API_URL`: `http://3.148.78.23:5000` (La IP estática de nuestro backend en Lightsail).
    -   **Render URL:** `https://tecnotitlan.onrender.com` (URL pública del frontend desplegado).


### 7.3.2. Guía de Despliegue en Producción (Backend en Lightsail)

El backend se ejecuta como un contenedor de Docker en la instancia `Ubuntu-1` de AWS Lightsail.

1.  **Conexión al Servidor:**
    Conéctate a la instancia vía SSH usando las credenciales correspondientes.

2.  **Clonar o Actualizar Repositorio:**
    Si es el primer despliegue, clona el repositorio. Si es una actualización, haz `pull` de los últimos cambios.
    ```bash
    # Para el primer despliegue
    git clone https://<TU_PAT>@github.com/zionfinale-cloud/Tecnotitlan.git
    cd tecnotitlan

    # Para actualizaciones
    git pull origin main
    ```

3.  **Configurar Variables de Entorno:**
    Crea o edita el archivo `.env` en la raíz del proyecto con las variables de producción (especialmente `DATABASE_URL`, `JWT_SECRET`, y las claves de las pasarelas de pago).

4.  **Construir y Ejecutar el Contenedor Docker:**
    Desde la raíz del proyecto, utiliza Docker Compose para construir la nueva imagen y reiniciar el servicio en segundo plano.
    ```bash
    sudo docker-compose up --build -d
    ```

### 7.4. Guía de Despliegue en Producción (VPS para n8n)

#### 7.4.1. Detalles de Infraestructura (AWS Lightsail)

-   **Nombre de la Instancia:** `Ubuntu-1`
-   **Nombre de la IP Estática:** `tecnotitlan-static`
-   **IP Estática Pública:** `3.148.78.23`
-   **Región:** Ohio, us-east-2
-   **Especificaciones:** 512 MB RAM, 2 vCPUs, 20 GB SSD
-   **Sistema Operativo:** Ubuntu

Esta instancia será el servidor principal para alojar el **backend de Node.js** y el motor de automatización **n8n**, ambos gestionados a través de Docker.

---

#### 7.4.2. Pasos de Despliegue

1.  **Preparar el VPS:**
    Conéctate por SSH y actualiza el sistema.
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```

2.  **Instalar Docker y Docker Compose:**
    ```bash
    sudo apt install docker.io docker-compose -y
    sudo systemctl start docker && sudo systemctl enable docker
    sudo usermod -aG docker  # Requiere reiniciar sesión SSH
    ```

3.  **Configurar y Ejecutar n8n:**
    Crea un archivo `docker-compose.yml` con la siguiente configuración, reemplazando los placeholders con tus credenciales de la base de datos y tu dominio.
    ```yaml
    version: '3.8'
    services:
      n8n:
        image: n8nio/n8n
        restart: always
        ports:
          - "5678:5678"
        environment:
          - DB_TYPE=postgres
          - DB_POSTGRES_HOST=db.ecfbrxohxvvpwrhqzpwk.supabase.co # Host directo de tu DB en Supabase
          - DB_POSTGRES_DATABASE=postgres
          - DB_POSTGRES_USER=postgres
          - DB_POSTGRES_PASSWORD=TU_PASSWORD_SECRETA_DE_SUPABASE # ¡Usa un secreto de entorno!
          - N8N_HOST=n8n.tecnotitlan.mx # Tu dominio
          - WEBHOOK_URL=https://n8n.tecnotitlan.mx/
          - NODE_ENV=production
          - GENERIC_TIMEZONE=America/Mexico_City
        volumes:
          - n8n_data:/home/node/.n8n
    volumes:
      n8n_data:
    ```
    Inicia el contenedor: `docker-compose up -d`

4.  **Configurar Reverse Proxy y SSL (Crítico):**
    Es **indispensable** configurar un reverse proxy (como Nginx o Caddy) para usar tu dominio y añadir un certificado SSL (HTTPS).

---

## 8. Integración Continua (CI/CD)

El proyecto utiliza **GitHub Actions** para automatizar las pruebas del backend. El workflow se encuentra en `.github/workflows/backend-ci.yml` y realiza los siguientes pasos en cada `push` o `pull request` a la rama `main`:

1.  **Checkout:** Clona el repositorio.
2.  **Set up Node.js:** Configura el entorno de Node.js v18.
3.  **Connect to DB:** Se conecta a la base de datos de Supabase usando un secreto (`DATABASE_URL`) para un entorno de prueba realista.
4.  **Install Dependencies:** Instala las dependencias del proyecto.
5.  **Run Tests:** Ejecuta las pruebas del backend con `npm run test:backend`.

Este pipeline asegura que el código nuevo no rompa la funcionalidad existente.

---

## 9. Hoja de Ruta y Próximos Pasos

1.  **Fortalecer Pruebas en el Frontend:**
    -   **Base Establecida:** Pruebas unitarias y de integración con **React Testing Library**.
    -   **Próximo Paso (Pruebas End-to-End):** Implementar **Cypress** o **Playwright** para automatizar flujos críticos de usuario.

2.  **Funcionalidades Futuras:**
    -   Completar la integración con **Mercado Libre**.
    -   Expandir las capacidades del **Chatbot de WhatsApp** para consultas de estado de pedidos.
    -   Implementar las APIs de **Amazon** y **TikTok Shop**.
    -   Implementar funcionalidades de IA con **Gemini**.

---

## 10. Pipeline de Infraestructura y Flujo de Trabajo

A continuación se describe la arquitectura completa del pipeline de automatización, con el objetivo de lograr un sistema de Dropshipping eficiente con costos fijos mínimos.

### Componentes de Costo Fijo Bajo (Fase de Producción)
1.  **Dominio:** `Tecnotitlan.mx` (~-2/mes anualizado).
2.  **Motor de Automatización (n8n):** VPS en AWS Lightsail (Trial/~ USD/mes) con Docker.
3.  **Base de Datos:** Supabase (Free Tier).
4.  **Frontend:** Render/Vercel (Free Tier) + Uptime Robot (para evitar que el servicio se "duerma").

> **Aclaración sobre la Licencia de n8n:**
> n8n opera con un modelo "source-available". La versión que se utiliza en este proyecto es **self-hosted** (auto-alojada) a través de Docker. Esta modalidad de uso es **gratuita**. Los planes de pago de n8n corresponden a su servicio en la nube (n8n Cloud), donde ellos gestionan la infraestructura. Al nosotros gestionar nuestro propio servidor (VPS), solo pagamos por el costo del servidor, no por la licencia del software n8n.

### Flujo de Trabajo Completo (Pipeline)

#### ➡️ ETAPA 1: Ingreso del Pedido (Render -> Supabase)
1.  **FRONTEND (RENDER):** El cliente completa el checkout en la tienda web.
2.  **ACCIÓN:** El código de la tienda (Frontend) realiza una inserción (`INSERT`) directa a la tabla `orders` en la base de datos de Supabase.

#### ➡️ ETAPA 2: Activación del Motor (Supabase Trigger -> n8n Webhook)
3.  **TRIGGER (SUPABASE):** Un Trigger de PostgreSQL (`AFTER INSERT ON orders`) se activa automáticamente.
4.  **PUENTE:** La función del Trigger llama a un **Webhook de n8n** alojado en el VPS.
    -   *URL del Webhook a configurar en Supabase:* `https://n8n.tecnotitlan.mx/webhook/TU_WEBHOOK_ID_SECRETO`

#### ➡️ ETAPA 3: Automatización (n8n en VPS)
5.  **WEBHOOK (n8n):** Recibe el ID del pedido y **ACTIVA** el Workflow.
6.  **SUPABASE:** Consulta la DB para obtener todos los detalles del pedido (productos, dirección, etc.).
7.  **MARKETPLACE/PROVEEDOR:** Nodo "HTTP Request" para enviar la orden de compra (dropshipping) a la API del proveedor.
8.  **WHATSAPP (Cliente):** Envía la confirmación del pedido al cliente (usando una Plantilla de Utilidad).
9.  **WHATSAPP (Admin):** Envía una notificación interna de "Nuevo Pedido" al número personal del administrador (Mensaje de Texto plano).
10. **SUPABASE:** Actualiza el estado del pedido a "Procesado" y guarda la guía de envío/rastreo recibida del proveedor.

### Aclaración sobre la Ejecución de Node.js

La gran ventaja de esta arquitectura es la forma en que se utiliza Node.js.

#### ⚙️ El Node.js Ejecutado es n8n

El código Node.js que necesita ejecutarse de forma continua (24/7) es el motor de **n8n**, ya que n8n es una aplicación desarrollada en Node.js. Al instalarlo con Docker en la instancia de Lightsail, se está ejecutando una instancia persistente de Node.js que gestionará todos los workflows, notificaciones de WhatsApp y la sincronización con los marketplaces.

#### La División de la Lógica

-   **Node.js en el Frontend (Render):** El frontend de la tienda (React, Next.js, etc.) puede usar un entorno Node.js para el renderizado. Este código es el que se "despierta y duerme", y su única función crítica en este pipeline es guardar el pedido inicial en Supabase.

-   **Node.js en el Backend (Lightsail/n8n):** La instancia de n8n está siempre activa en Lightsail. Esta instancia ejecuta el código Node.js necesario para:
    - Escuchar el Webhook de Supabase.
    - Conectarse a la base de datos para obtener detalles.
    - Enviar solicitudes a las APIs de los proveedores.
    - Gestionar el bot de WhatsApp.

### Estrategia de Desarrollo del Pipeline (n8n Local)

Para construir y probar los workflows de n8n de forma segura y sin costo antes del despliegue, se utiliza un entorno de desarrollo local completamente integrado gracias a Docker.

#### 1. Ambiente Local (Tu PC)
-   **Software a Usar:** El archivo `docker-compose.yml` orquesta todos los servicios necesarios: el backend, la base de datos PostgreSQL y el motor de n8n.
-   **Costo:**  USD (solo el consumo de recursos de tu equipo).
-   **Función:** Construir y probar la lógica: conectar el nodo de Supabase, dar formato a los mensajes de WhatsApp y mapear el envío al proveedor.
-   **Limitación:** Los Webhooks no funcionarán, ya que tu IP local no es pública. Se debe usar el botón **"Execute Workflow"** manualmente para las pruebas.

#### Secuencia Recomendada
1.  **Instalar n8n Localmente:** Sigue la guía oficial para instalar la versión Desktop (la más fácil).
2.  **Construir Workflows:** Accede a n8n y crea todos los flujos necesarios (Pedido a WhatsApp, Actualización de Stock, etc.), conectándolos a la base de datos de desarrollo/producción en Supabase.
3.  **Verificar Lógica:** Ejecuta manualmente cada flujo para confirmar que se conecta a la base de datos de Supabase y procesa los datos correctamente.
4.  **Desplegar a Producción:** Solo cuando toda la lógica esté lista y probada, puedes exportar los workflows (como JSON) y desplegarlos en la instancia de n8n en producción (VPS).

---

> **💡 NOTA CLAVE:** El motor de **n8n en el VPS** es el único componente de pago fijo (~/mes) que garantiza la ejecución 24/7 de la lógica crítica del negocio, mientras que los demás componentes (Base de Datos, Frontend) escalan desde sus capas gratuitas.

---

## 11. Arquitectura de Roles y Permisos (Sistema RBAC)

Para lograr un control de acceso modular y flexible, se ha implementado un sistema de **Control de Acceso Basado en Roles (RBAC)**. Esto permite crear roles personalizados (como "Vendedor", "Editor de Contenido", etc.) y asignarles permisos específicos, yendo más allá de los roles estáticos.

### Componentes Clave
- **Modelos de Datos:** `Role`, `Permission` y sus relaciones están definidos en `d:/Tecnotitlan/backend/prisma/schema.prisma`.
- **Seeding Inicial:** El script `d:/Tecnotitlan/backend/prisma/seed.js` crea el rol `SUPER_ADMIN` y los permisos base.
- **Gestión en Frontend:** Las pantallas `RoleListScreen.js` y `RoleEditScreen.js` permiten la administración de roles y permisos.
- **Protección de Rutas:** El middleware `d:/Tecnotitlan/backend/src/middleware/permissionMiddleware.js` (`checkPermission`) se encarga de validar los permisos en las rutas del backend.

---

## 12. Arquitectura de Configuración de WhatsApp

La gestión de la conexión de WhatsApp se realiza desde el panel de administración, permitiendo vincular un dispositivo escaneando un código QR sin acceder a la terminal del servidor.

### Componentes Clave
- **Backend:** El servicio `whatsappService.js` y los endpoints de control en `index.js` gestionan la inicialización y el estado de la conexión mediante **Socket.IO**.
- **Frontend:** La pantalla `WhatsappSettingsScreen.js` se conecta vía WebSockets para mostrar el código QR y el estado de la conexión en tiempo real.
