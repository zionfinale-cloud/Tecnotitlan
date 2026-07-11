# Documentación Maestra del Proyecto: Tecnotitlan

> **Estado del documento (15 de junio de 2026):** Este archivo conserva contexto
> histórico y funcional, pero contiene decisiones antiguas de Lightsail y cPanel
> que ya no representan la arquitectura vigente. Para instalación, estructura y
> despliegue actuales, comenzar por `README.md`.

Este documento es la guía técnica central y única fuente de verdad para el proyecto de e-commerce **Tecnotitlan**. Cubre la visión, arquitectura, guías de instalación, despliegue y hoja de ruta.

## 1. Visión General y Objetivos

- **Core Business:** Plataforma de e-commerce **"marca blanca"** y personalizable, diseñada para ser replicada en diferentes nichos de mercado (ej. tecnología, ropa, etc.). El sistema permite una personalización completa del frontend (nombre, logo, colores, slogan) a través del panel de administración.
- **Omnicanal:** Sistema centralizado que se integra con múltiples canales de venta, incluyendo redes sociales (Facebook, Instagram, TikTok Shop) y marketplaces (Mercado Libre, Amazon).
- **Comunicación Automatizada:**

    - **Bot de WhatsApp:** Conectado a través de **Baileys** (librería ligera de WebSockets), gestionado y configurable desde el panel de administración. Se reemplazó `whatsapp-web.js` para eliminar la dependencia de Chromium y asegurar compatibilidad con cPanel.
    - **Chatbot Web:** Sincronizado con el sistema para ofrecer soporte en tiempo real.
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

## 2. Bitácora de Vuelo: Continuidad del Proyecto

**Última Actualización:** 13 de Febrero, 2026 (Cierre de Sesión)

Esta sección define la trayectoria del proyecto para asegurar que no perdamos el contexto entre sesiones de trabajo. **Fase de Estabilización en Producción.**

**Dominios:**
- `https://www.tecnotitlan.com.mx` (Frontend - ❌ ERROR DE DESPLIEGUE)
- `https://api.tecnotitlan.com.mx` (Backend - ✅ ONLINE)

### 2.1. De dónde venimos (Logros de la Sesión)
- **Backend Optimizado:** Se configuró `deploy.sh` para inyectar `UV_THREADPOOL_SIZE=2` y manejar `SIGTERM` para evitar saturar los procesos de cPanel (límite de 100).
- **Build Frontend Generado:** Se generó un build local exitoso con la variable `REACT_APP_RECAPTCHA_SITE_KEY` correcta.
- **Intento de Despliegue:** Se intentó subir el build a la carpeta del dominio adicional `tecnotitlan.com.mx`.

### 2.2. Dónde estamos (Bloqueo Actual)
**No hemos logrado que el frontend cargue correctamente en producción.**

*   **Síntoma:** Al subir los archivos a la carpeta del dominio, la página no carga o no refleja los cambios (posible problema de rutas o caché persistente).
*   **Diagnóstico:** Existe confusión sobre la ruta raíz exacta del dominio adicional en cPanel (`public_html/tecnotitlan.com.mx` vs `tecnotitlan.com.mx` fuera de public_html) y cómo el servidor web está sirviendo los archivos estáticos.
*   **Estado:** Pendiente de validar la ruta correcta con un archivo `prueba.html` y asegurar que el contenido de `build` (no la carpeta en sí) esté en la raíz correcta.

### 2.3. A dónde vamos (Próximos Pasos al Retomar)
1.  **Prueba de "Hola Mundo":** Subir un archivo HTML simple a la carpeta del dominio para confirmar la ruta raíz web real.
2.  **Corrección de Estructura:** Mover los archivos del build al nivel correcto si quedaron anidados.
3.  **Verificación de Registro:** Una vez visible el frontend, probar el flujo de registro con el Captcha ya configurado.

## 2.4. Pila Tecnológica

- **Backend:** Node.js, Express.js
- **Base de Datos:** PostgreSQL con **Prisma** (ORM moderno y type-safe)
- **Frontend:** React.js (Create React App)
- **Autenticación:** JSON Web Tokens (JWT). Sesiones de Express para flujos OAuth 2.0 con **PKCE** (Proof Key for Code Exchange) para integraciones como Mercado Libre.
- **Estilos:** **CSS Modules** y CSS plano. Se utilizan variables CSS globales para el theming. `react-bootstrap` se usa para componentes estructurales como `Container` y `Grid`, pero los estilos finos son personalizados.
- **Peticiones API:** Axios
- **Pruebas (Backend):** Jest, Supertest.
- **Pruebas (Frontend):** React Testing Library, Jest
- **Automatización:** n8n (self-hosted en cPanel).
- **Contenerización:** Docker (Suspendido temporalmente). Todo el desarrollo se realiza directamente en producción (cPanel) con Node.js nativo.

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
- **Arquitectura Omnicanal Vigente (julio 2026):** Tecnotitlan es el centro de control del negocio. El inventario, costos, margenes, productos y cortes viven primero en Tecnotitlan; los marketplaces son canales conectados, no fuentes de verdad. La prioridad de integracion sera:
    1. **Web propia:** canal principal para validar catalogo, inventario, checkout, soporte y automatizaciones n8n.
    2. **Mercado Libre:** primer marketplace externo por afinidad con Mexico, Mercado Envios y volumen comercial.
    3. **TikTok Shop:** segundo marketplace externo, ideal para gadgets y ventas por contenido cuando el inventario ya este estable.
    4. **Amazon:** tercer marketplace externo por complejidad operativa, comisiones, reglas de listing y SP-API.
  Cada producto mantiene un SKU maestro interno (`AUR-001`, `BOC-001`, `DRN-001`, `WTC-001`, etc.) y puede tener publicaciones por canal con precio, stock publicado, comision estimada, ID externo y estado de sincronizacion propios. Ningun marketplace debe modificar inventario directo: las ventas externas se importan como ordenes externas y generan movimientos de inventario controlados por el backend.
- **Guias y fulfillment por canal:** En la web propia se integrara un agregador logistico (preferentemente Envia.com o Skydropx) para cotizar y generar guias. En marketplaces se respetara la logistica nativa cuando aplique: Mercado Envios para Mercado Libre, fulfillment/logistica de TikTok Shop cuando este disponible y Amazon Seller/FBA segun la estrategia. Tecnotitlan guardara tracking, costo real, estado y evidencia, aunque la guia venga de una plataforma externa.
- **Flujo correcto de producto e inventario:** Un producto nuevo se crea primero como ficha de catalogo: categoria, prefijo SKU, nombre, descripcion comercial, imagenes, video, especificaciones, precio web y datos de envio. El alta de producto permite elegir `Auto por categoria`, seleccionar un prefijo existente o crear uno nuevo de 2 a 3 caracteres; el backend genera el consecutivo y el SKU queda congelado despues de crear el producto para no romper inventario, pedidos ni canales. El stock real no debe improvisarse en el formulario del producto; debe registrarse despues desde Inventario mediante una entrada ligada a una inversion, cantidad y costo unitario. Esto permite saber cuanto se compro, cuanto se vendio, cuanto queda disponible y cuanto margen real deja cada canal.
- **Separacion contable-operativa:** Inversion, inventario y salidas no son lo mismo. La inversion representa dinero disponible y gastado. Las compras/entradas consumen esa inversion y aumentan stock fisico. El inventario muestra existencias por producto y stock publicado/asignado por canal (web, Mercado Libre, TikTok Shop, Amazon). Las salidas/ventas reducen stock, guardan canal de venta, ingreso, costo y utilidad para saber donde se vende mas, cuanto se gano y que productos deben recomprarse.
- **UI administrativa separada:** `Inversiones` debe vivir como apartado propio del sidebar para registrar y consultar capital disponible/gastado. `Inventario` no administra capital; solo registra entradas de mercancia, muestra existencias por canal, movimientos y cortes de ventas.
- **Distribucion de stock por canal:** Las entradas de mercancia aumentan primero el stock de bodega/web del producto. Si se apartan o envian piezas a Mercado Libre, TikTok Shop o Amazon, se registra un traspaso desde Inventario: baja el stock de bodega/web y aumenta el stock publicado/asignado del canal. `Canales` configura precio, IDs externos y datos de publicacion; no debe ser el lugar principal para mover mercancia fisica.
- **API Centralizada (`apiService.js`):** Un único punto de entrada para todas las peticiones del frontend, utilizando interceptores de Axios para:
    - Adjuntar automáticamente tokens de autenticación.
    - Estandarizar el manejo de respuestas y errores.
    - Gestionar la expiración de sesión de forma global.
- **Autorización RBAC Flexible:** El acceso a rutas protegidas (ej. el panel de admin) se controla mediante permisos (`access:admin_panel`) en lugar de roles fijos. El rol base define permisos heredados, pero cada usuario puede tener excepciones individuales: permisos permitidos extra (`UserPermissionGrant`) y permisos bloqueados (`UserPermissionDeny`). Esto permite que un vendedor especifico pueda tener mas acceso que otro sin crear roles duplicados, y permite ocultar costos, inversiones o configuraciones sensibles a quien no deba verlas.
- **Estilos con CSS Modules:** Se adoptó un enfoque de estilos encapsulados por componente para evitar conflictos de clases y mejorar la mantenibilidad. Las variables CSS globales (`:root` en `index.css`) permiten una personalización centralizada del tema.
- **Hooks Personalizados (`use...`):** La lógica de estado y las llamadas a API se abstraen en hooks reutilizables (`useFormValidation`, `useProductFilters`, `useCategoryManager`, `useProductForm`), centralizando la lógica compleja y haciendo los componentes más limpios y declarativos.
- **Lógica de Precios Segura:** El cálculo de precios y totales se realiza exclusivamente en el backend (`orderController.js`) para prevenir manipulaciones desde el cliente.
- **Transacciones Atómicas en la Base de Datos:** Se utilizan las **transacciones interactivas de Prisma** (`$transaction`) para garantizar que operaciones complejas (como crear un pedido y descontar stock) se completen con éxito o fallen juntas, manteniendo la consistencia de los datos.
- **Componentes Modulares y Reutilizables:** Se ha adoptado un enfoque de componentización para la UI. La lógica de la interfaz se divide en componentes pequeños y enfocados, como `ProductGrid.js` (para mostrar productos en una cuadrícula) y `SmartwatchShowcase.js` (una sección destacada configurable), lo que mejora la legibilidad y facilita la reutilización de código.
- **Estrategia de Conexión a Base de Datos (Supabase):** Se utiliza una configuración dual para optimizar la conexión con Supabase en entornos Serverless/Docker:
    - **Transaction Pooler (Puerto 6543):** Utilizado por la aplicación en producción (`DATABASE_URL`) para gestionar eficientemente las conexiones y evitar el agotamiento de límites. Requiere el parámetro `?pgbouncer=true`.
    - **Conexión Directa (Puerto 5432):** Utilizada exclusivamente para migraciones de esquema (`DIRECT_URL`), ya que Prisma necesita control total sobre la conexión para cambios estructurales.
- **Estrategia de Subida de Archivos Flexible:** El sistema de subida de imágenes (`uploadController.js`) es dinámico y configurable mediante una variable de entorno (`UPLOAD_STRATEGY`), permitiendo cambiar entre almacenamiento local y Cloudinary sin modificar el código.
- **Estandarización de Respuestas API:** Todas las respuestas del backend siguen un formato consistente (`{ status: 'success', data: {...} }` o `{ status: 'error', message: '...' }`), lo que simplifica la lógica del frontend.
- **Seguridad del Backend:** Se implementan medidas de seguridad estándar como `helmet` para cabeceras HTTP, `cors` para control de origen y `express-rate-limit` para prevenir ataques de fuerza bruta en endpoints de autenticación.
- **Sistema de Configuración Dinámica:** La aplicación carga su configuración (claves de API, nombres, etc.) desde la base de datos al arrancar (`configService.js`). Esto permite a los administradores modificar el comportamiento y las integraciones (PayPal, Meli, WhatsApp) a través del panel de administración (`/admin/settings/*`) sin necesidad de redesplegar el código.
- **Archivado Lógico (Soft Delete):** Los productos no se eliminan directamente, sino que se marcan como archivados (`isArchived: true`). Esto permite restaurarlos en el futuro y mantiene la integridad de los datos en pedidos antiguos. Existe una opción para la eliminación permanente.
    - **Generación Automática de SKU:** Para evitar errores manuales y estandarizar el catálogo, los SKUs se generan en el backend (`productController.js`) al momento de la creación usando el prefijo elegido en el formulario (`AUR`, `BOC`, `DRN`, etc.) y un consecutivo de tres digitos (`AUR-001`). Si se elige `Auto por categoria`, el sistema infiere el prefijo desde la categoria. Si hace falta una linea nueva, el admin puede crear el prefijo desde el mismo selector.
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
    - ✅ **Creación de Pedidos:** El pedido se crea en estado pendiente de pago. No debe descontar inventario todavia.
    - ✅ **Inventario al Confirmar Pago:** `orderInventoryService.js` registra salidas `SALE` solo cuando el pago queda confirmado por Stripe, webhook o confirmacion manual autorizada.
    - ✅ **Alertas Operativas:** Si el pago queda confirmado pero la salida de inventario falla por stock o inconsistencia, el sistema agrega una nota visible al historial del pedido para revision manual.
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

## 6. Archivos de Configuración Clave (Versión Final)

A continuación se muestran las versiones finales y funcionales de los archivos de configuración más importantes del proyecto.

### `d:\Tecnotitlan\Dockerfile`

```dockerfile
# --- Etapa 1: Dependencias (deps) ---
# Esta etapa solo instala las dependencias para optimizar la caché.
FROM node:18-slim AS deps

WORKDIR /app

# Copia los archivos de dependencias y el esquema de Prisma.
COPY package*.json ./
COPY backend/prisma ./prisma/

# Instala las dependencias.
RUN npm install --force

# --- Etapa 2: Builder ---
# Esta etapa copia el código fuente y las dependencias ya instaladas.
FROM node:18-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- Etapa 3: Ejecución (final) ---
# Esta es la imagen final, optimizada y ligera para producción.
FROM node:18-slim AS final

WORKDIR /app

# Copia solo los artefactos necesarios del backend desde la etapa 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend ./backend

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]
```

### `d:\Tecnotitlan\docker-compose.yml`

```yaml
services:
  backend: # Nombre del servicio
    build:
      context: . # El contexto es la raíz del proyecto, donde está este archivo.
      dockerfile: Dockerfile # El Dockerfile que usará está en la misma raíz.
    container_name: tecnotitlan_backend
    ports: # Mapeo de puertos
      - "5000:5000" # Expone el puerto 5000 del contenedor al puerto 5000 del host
    env_file: # Archivo de variables de entorno
      - ./.env # Carga las variables desde el archivo .env en la raíz.
    restart: always # Reinicia el contenedor si falla
    networks: # Conecta el servicio a la red compartida
      - tecnotitlan-net

  n8n:
    image: n8nio/n8n:latest # Usamos la última imagen estable de n8n
    container_name: tecnotitlan_n8n
    restart: always
    ports:
      - "5678:5678"
    env_file:
      - ./.env # Reutilizamos el mismo archivo .env para las credenciales
    environment:
      - GENERIC_TIMEZONE=America/Mexico_City # Asegura la zona horaria correcta
    volumes:
      - n8n_data:/home/node/.n8n # Persiste los datos y workflows de n8n
    networks:
      - tecnotitlan-net

networks: # Define la red compartida
  tecnotitlan-net:

volumes: # Define el volumen para persistir los datos de n8n
  n8n_data:
```

### `d:\Tecnotitlan\deploy.sh`

```shellscript
#!/bin/bash

# deploy.sh - Script para automatizar el despliegue de Tecnotitlan en cPanel.
# Este script actualiza el código y reinicia la aplicación Node.js.

# Salir inmediatamente si un comando falla para evitar un estado inconsistente.
set -e

echo "🚀  Iniciando el despliegue de Tecnotitlan en cPanel..."

# 1. Obtener los últimos cambios desde el repositorio de Git.
echo "  Saltando actualización de Git (Modo Desarrollo en Vivo)..."
# git pull origin main

# 2. Instalar dependencias (si hubo cambios en package.json)
echo "📦  Instalando dependencias..."
npm install --production

# 3. Reiniciar la aplicación Node.js (Phusion Passenger)
echo "🔄  Reiniciando servidor..."
mkdir -p tmp
touch tmp/restart.txt

echo "✅  ¡Despliegue completado con éxito!"
```

---

## 7. Referencia de Rutas de Archivos

Para facilitar la navegación y el análisis futuro del código, a continuación se listan las rutas de los archivos más relevantes del proyecto.

### 7.1. Backend (`/backend`)

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
-   `d:/Tecnotitlan/backend/src/routes/whatsappRoutes.js`
-   **Middlewares:**
-   `d:/Tecnotitlan/backend/src/middleware/authMiddleware.js`
-   `d:/Tecnotitlan/backend/src/middleware/permissionMiddleware.js`
-   `d:/Tecnotitlan/backend/src/middleware/validationMiddleware.js`
-   `d:/Tecnotitlan/backend/src/middleware/errorMiddleware.js`
-   **Servicios:**
-   `d:/Tecnotitlan/backend/src/services/whatsappService.js`
-   `d:/Tecnotitlan/backend/src/services/configService.js`
-   `d:/Tecnotitlan/backend/src/services/mercadoLibreService.js`
-   `d:/Tecnotitlan/backend/src/services/emailService.js`
-   `d:/Tecnotitlan/backend/src/services/captchaService.js`

### 7.2. Frontend (`/frontend`)

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
-   `d:/Tecnotitlan/frontend/src/hooks/useFormValidation.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useProductFilters.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useCategoryManager.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useProductForm.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useDashboardStats.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useApi.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useConfirmation.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useLocalStorage.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useOrderFilters.js`
-   `d:/Tecnotitlan/frontend/src/hooks/usePageTitle.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useProductDetail.js`
-   `d:/Tecnotitlan/frontend/src/hooks/useReports.js`
-   **Componentes Reutilizables (`/frontend/src/components`):**
-   `d:/Tecnotitlan/frontend/src/components/Header.js`
-   `d:/Tecnotitlan/frontend/src/components/Footer.js`
-   `d:/Tecnotitlan/frontend/src/components/ProtectedRoute.js`
-   `d:/Tecnotitlan/frontend/src/components/HeroSection.js`
-   `d:/Tecnotitlan/frontend/src/components/LoadingSpinner.js`
-   `d:/Tecnotitlan/frontend/src/components/Notification.js`
-   `d:/Tecnotitlan/frontend/src/components/SessionManager.js`
-   `d:/Tecnotitlan/frontend/src/components/ProductGrid.js`
-   `d:/Tecnotitlan/frontend/src/components/SmartwatchShowcase.js`
-   `d:/Tecnotitlan/frontend/src/components/AddToCartNotification.js`
-   `d:/Tecnotitlan/frontend/src/components/Breadcrumb.js`
-   `d:/Tecnotitlan/frontend/src/components/CheckoutSteps.js`
-   `d:/Tecnotitlan/frontend/src/components/FilterControls.js`
-   `d:/Tecnotitlan/frontend/src/components/FormContainer.js`
-   `d:/Tecnotitlan/frontend/src/components/OrderTable.js`
-   `d:/Tecnotitlan/frontend/src/components/Product.js`
-   `d:/Tecnotitlan/frontend/src/components/ProductCardSkeleton.js`
-   `d:/Tecnotitlan/frontend/src/components/ProductTable.js`
-   `d:/Tecnotitlan/frontend/src/components/RegisterForm.js`
-   `d:/Tecnotitlan/frontend/src/components/SearchBox.js`
-   `d:/Tecnotitlan/frontend/src/components/StripeCheckoutForm.js`
-   **Páginas de Cliente y Admin (`/frontend/src/pages`):**
    -   **Cliente (Screens):**
        - `d:/Tecnotitlan/frontend/src/screens/LoginScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/RegisterScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/VerifyAccountScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/ProfileScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/HomeScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/ProductDetailScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/CartScreen.js`
        - `d:/Tecnotitlan/frontend/src/screens/TermsOfService.js`
        - `d:/Tecnotitlan/frontend/src/screens/PrivacyPolicy.js`
    -   **Panel de Administración:**
-   `d:/Tecnotitlan/frontend/src/pages/admin/AdminLayout.js`: Layout principal del panel.
-   `d:/Tecnotitlan/frontend/src/pages/admin/SubMenu.js`
-   `/admin/dashboard`: `d:/Tecnotitlan/frontend/src/pages/admin/AdminDashboard.js`
-   `/admin/productlist`: `d:/Tecnotitlan/frontend/src/pages/admin/ProductListScreen.js`
-   `/admin/products/create`: `d:/Tecnotitlan/frontend/src/pages/admin/ProductCreateScreen.js`
-   `/admin/products/edit/:sku`: `d:/Tecnotitlan/frontend/src/pages/admin/ProductEditScreen.js`
-   `/admin/orderlist`: `d:/Tecnotitlan/frontend/src/pages/admin/OrderListScreen.js`
-   `/admin/categories`: `d:/Tecnotitlan/frontend/src/pages/admin/CategoryListScreen.js`
-   `/admin/userlist`: `d:/Tecnotitlan/frontend/src/screens/admin/UserListScreen.js`
-   `d:/Tecnotitlan/frontend/src/screens/admin/UserListScreen.module.css`
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
### 7.3. Pruebas, CI/CD y Documentación
-   **Utilidades de Prueba:**
-   `d:/Tecnotitlan/frontend/src/test-utils/renderWithProviders.js`: Helper para renderizar componentes con sus contextos mockeados.
-   **Pruebas E2E (Cypress):**
    - `d:/Tecnotitlan/frontend/cypress/e2e/auth/login.cy.js`: Prueba el flujo de inicio de sesión del administrador.
    - `d:/Tecnotitlan/frontend/cypress/e2e/checkout.cy.js`: Prueba el flujo de compra completo, desde añadir un producto al carrito hasta la confirmación del pedido.
-   **CI/CD:**
    -   `d:/Tecnotitlan/.github/workflows/backend-ci.yml`: Workflow de GitHub Actions para pruebas del backend.
-   **Raíz del Proyecto:**
-   `d:/Tecnotitlan/package.json`: Dependencias y scripts del backend.
-   `d:/Tecnotitlan/frontend/package.json`: Dependencias y scripts del frontend.
-   `d:/Tecnotitlan/.env`: Variables de entorno (local, no versionado).
-   `d:/Tecnotitlan/README.md`: Documentación general del proyecto.
-   `d:/Tecnotitlan/DOCUMENTACION_MAESTRA_TECNOTITLAN.md`: Este mismo documento.
-   `d:/Tecnotitlan/docker-compose.yml`: Orquestación de servicios locales (Postgres, n8n).

---

## 8. Guía de Instalación y Despliegue

### 8.1. Configuración de Variables de Entorno (.env)

Para la estrategia de **"Desarrollo en Vivo"**, estas variables deben configurarse en el panel de cPanel ("Setup Node.js App" > Environment Variables) o en el archivo `.env` en la raíz del backend.

#### Plantilla de Producción
    ```env
    # CONFIGURACIÓN GENERAL
    NODE_ENV=production
    PORT=5000
    JWT_SECRET=tu_secreto_super_secreto_aqui
    
    # =================================
    # BASE DE DATOS (PostgreSQL)
    # =================================
    # Opción 1: Usar una base de datos local con Docker (requiere configuración en docker-compose.yml)
    # DATABASE_URL="postgresql://postgres:password@localhost:5432/tecnotitlan?schema=public"
    # Opción 2: Usar la base de datos de Supabase (recomendado para un entorno de desarrollo consistente)
    DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true" # URL con Pooler para la app (IMPORTANTE: ?pgbouncer=true)
    DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" # URL directa para migraciones de Prisma
    
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
    MERCADOLIBRE_REDIRECT_URI=https://api.tecnotitlan.com.mx/admin/settings/mercado-libre/callback
    CLIENT_URL_PRIMARY=https://www.tecnotitlan.com.mx # URL del Frontend (necesario para CORS)
    RECAPTCHA_SECRET_KEY=tu_clave_secreta_de_google_recaptcha
    ```

### 8.2. Scripts Disponibles

- `npm run dev`: Ejecuta backend y frontend simultáneamente.
- `npm run server`: Inicia solo el servidor backend.
- `npm run client`: Inicia solo la aplicación de React.
- `npm run test:backend`: Ejecuta las pruebas del backend.
- `npm run seed:import`: Puebla la base de datos con datos de prueba.
- `npm run seed:destroy`: Elimina los datos de la base de datos.

### 8.3. Arquitectura de Despliegue (Estrategia cPanel de Alto Rendimiento)

**Actualización (Febrero 2026):** Se ha migrado la infraestructura a un entorno **cPanel de Alto Rendimiento** (6 vCPU, 6GB RAM, 100GB SSD).

-   **Base de Datos:** PostgreSQL (Supabase o Local en cPanel si está disponible).
-   **Backend:** Ejecutándose como aplicación Node.js nativa en cPanel.
-   **WhatsApp:** Integrado mediante **Baileys** (Socket) dentro del backend.
-   **Automatización (n8n):** Ejecutándose en el mismo servidor cPanel (vía Node.js).

#### 8.3.1. Guía de Despliegue en Producción (Frontend en cPanel)

El frontend se despliega como un **Sitio Estático** directamente en el hosting compartido, eliminando la dependencia de servicios externos como Render.

> **⚠️ ADVERTENCIA:** No intentes usar la herramienta "Setup Node.js App" de cPanel para el frontend. El proceso `npm run build` consume demasiada memoria y fallará. El frontend **no es una aplicación de Node.js**, es un conjunto de archivos estáticos que se sirven directamente.

**Estrategia: Build Local -> Subida FTP/File Manager**

1.  **Generar Build Local:**
    En tu máquina de desarrollo (no en el servidor), ejecuta:
    ```bash
    cd frontend
    # Asegúrate de que .env tenga las variables críticas:
    # REACT_APP_API_URL=https://api.tecnotitlan.com.mx
    # REACT_APP_RECAPTCHA_SITE_KEY=tu_clave_publica_de_recaptcha
    npm install
    npm run build
    ```

2.  **Subir Archivos:**
    -   Se generará una carpeta `build`.
    -   Sube **el contenido** de esa carpeta (index.html, static/, etc.) a la carpeta raíz del dominio en cPanel (en tu caso: `tecnotitlan.com.mx`).
    -   **Importante:** Al ser un dominio adicional, NO uses `public_html` ya que ahí corren otros servicios.

3.  **Configuración de Rutas (.htaccess):**
    Para que el enrutamiento de React funcione (evitar error 404 al recargar páginas internas), crea o edita el archivo `.htaccess` en la carpeta donde subiste el frontend:

    ```apache
    <IfModule mod_rewrite.c>
      RewriteEngine On
      RewriteBase /
      RewriteRule ^index\.html$ - [L]
      RewriteCond %{REQUEST_FILENAME} !-f
      RewriteCond %{REQUEST_FILENAME} !-d
      RewriteCond %{REQUEST_FILENAME} !-l
      RewriteRule . /index.html [L]
    </IfModule>
    ```

    > **Nota:** Al ser archivos estáticos, **no es necesario reiniciar el servidor** en cPanel. Los cambios son inmediatos (si no los ves, limpia la caché de tu navegador).

#### 8.3.2. Guía de Despliegue en Producción (Backend en cPanel)

El backend se ejecuta utilizando la herramienta **"Setup Node.js App"** de cPanel.

#### Prerrequisito: Whitelist de IP en Supabase
Antes del primer despliegue, es **crítico** añadir la dirección IP de tu servidor cPanel a la lista de redes permitidas en Supabase para evitar errores de conexión (P1001).
1.  Obtén la IP de tu servidor (puedes usar `curl ifconfig.me` en la terminal SSH).
2.  En tu proyecto de Supabase, ve a `Project Settings` > `Database` > `Network Restrictions` y añade la IP.

1.  **Preparación en cPanel:**
    -   Acceder a "Setup Node.js App".
    -   Crear una nueva aplicación.
    -   **Node.js Version:** **18.x** (Recomendado por estabilidad con Prisma).
    -   **Application Mode:** Production.
    -   **Application root:** `repositories/Tecnotitlan/backend` (o la ruta donde clones el repo).
    -   **Application URL:** `api.tecnotitlan.com.mx`.
    -   **Application startup file:** `loader.cjs` (CRÍTICO: No usar `src/index.js` directamente).

2.  **Instalación de Dependencias:**
    -   Acceder vía SSH al servidor.
    -   Navegar a la carpeta del backend.
    -   Ejecutar `npm install`.

3.  **Variables de Entorno:**
    -   Configurar las variables del archivo `.env` directamente en la interfaz de cPanel o crear el archivo `.env` en la raíz de la aplicación.

4.  **Despliegue Automático (Script):**
    Utiliza el siguiente script `deploy.sh` adaptado para cPanel (requiere acceso SSH):

    ```shellscript
    #!/bin/bash
    # deploy.sh - Despliegue en cPanel
    
    # IMPORTANTE: Asegúrate de estar ejecutando este script dentro del entorno virtual de Node correcto (v18).
    # source /home/usuario/nodevenv/ruta/18/bin/activate
    
    set -e
    
    # Configuración crítica para estabilidad en cPanel: Usar motor binario
    export PRISMA_CLIENT_ENGINE_TYPE=binary
    
    echo "🚀 Iniciando despliegue en cPanel..."
    
    # 1. Actualizar código
    echo "🚫 Saltando actualización de Git (Modo Desarrollo en Vivo)..."
    
    # 2. Instalar dependencias del backend
    echo "📦 Instalando dependencias..."
    npm install --production
    
    # 2.1. Generar cliente de Prisma
    echo "💎 Generando cliente de Prisma..."
    npx prisma generate
    
    # 3. Reiniciar la aplicación Node.js (Método estándar cPanel)
    # Esto le indica a Phusion Passenger que reinicie la app
    if [ ! -d "tmp" ]; then
      mkdir tmp
    fi
    touch tmp/restart.txt
    
    echo "✅ Despliegue completado."
    ```

5.  **Verificación:**
    En cPanel (Phusion Passenger), la aplicación no siempre escucha en `localhost:5000`. Para verificar si está corriendo:
    ```bash
    # Opción 1: Consultar el dominio público
    curl -I https://api.tecnotitlan.com.mx
    
    # Opción 2: Revisar logs de errores si no responde (archivo generado por cPanel en la raíz de la app)
    cat stderr.log
    ```

> **Nota sobre WhatsApp:** Se utiliza **Baileys** por su ligereza y compatibilidad nativa con cPanel. Si en el futuro se requiere una API externa más robusta y se dispone de soporte Docker completo, se recomienda evaluar **EvolutionAPI**.

---

## 9. Integración Continua (CI/CD)

El proyecto utiliza **GitHub Actions** para automatizar las pruebas del backend. El workflow se encuentra en `.github/workflows/backend-ci.yml` y realiza los siguientes pasos en cada `push` o `pull request` a la rama `main`:

1.  **Checkout:** Clona el repositorio.
2.  **Set up Node.js:** Configura el entorno de Node.js v18.
3.  **Connect to DB:** Se conecta a la base de datos de Supabase usando un secreto (`DATABASE_URL`) para un entorno de prueba realista.
4.  **Install Dependencies:** Instala las dependencias del proyecto.
5.  **Run Tests:** Ejecuta las pruebas del backend con `npm run test:backend`.

Este pipeline asegura que el código nuevo no rompa la funcionalidad existente.

---

## 10. Hoja de Ruta y Próximos Pasos

1.  **Fortalecer Pruebas en el Frontend:**
    -   **Base Establecida:** Pruebas unitarias y de integración con **React Testing Library**.
    -   **En Progreso (Pruebas End-to-End):** Se ha configurado el workflow de **Cypress** (`frontend-e2e.yml`) y existen pruebas iniciales (`checkout.cy.js`).

2.  **Funcionalidades Futuras:**
    -   Completar la integración con **Mercado Libre**.
    -   Expandir las capacidades del **Chatbot de WhatsApp** para consultas de estado de pedidos.
    -   Implementar las APIs de **Amazon** y **TikTok Shop**.
    -   Implementar funcionalidades de IA con **Gemini**.

---

## 11. Pipeline de Infraestructura y Flujo de Trabajo

A continuación se describe la arquitectura completa del pipeline de automatización, con el objetivo de lograr un sistema de Dropshipping eficiente con costos fijos mínimos.

### Componentes de Costo Fijo Bajo (Fase de Producción)
1.  **Dominio:** `Tecnotitlan.mx` (~-2/mes anualizado).
2.  **Motor de Automatización (n8n):** Servidor cPanel (Infraestructura propia de alto rendimiento).
3.  **Base de Datos:** Supabase (Free Tier) o PostgreSQL local en cPanel.
4.  **Frontend:** Hospedado en cPanel (Archivos estáticos en `public_html`). Sin costos extra.

> **Aclaración sobre la Licencia de n8n:**
> n8n opera con un modelo "source-available". La versión que se utiliza en este proyecto es **self-hosted** (auto-alojada) ejecutándose como servicio Node.js. Esta modalidad de uso es **gratuita**. Los planes de pago de n8n corresponden a su servicio en la nube (n8n Cloud), donde ellos gestionan la infraestructura. Al nosotros gestionar nuestro propio servidor (cPanel), solo pagamos por el costo del hosting, no por la licencia del software n8n.

### Flujo de Trabajo Completo (Pipeline)

#### ➡️ ETAPA 1: Ingreso del Pedido (Frontend cPanel -> Supabase)
1.  **FRONTEND (CPANEL):** El cliente completa el checkout en la tienda web.
2.  **ACCIÓN:** El código de la tienda (Frontend) realiza una inserción (`INSERT`) directa a la tabla `orders` en la base de datos de Supabase.

#### ➡️ ETAPA 2: Activación del Motor (Supabase Trigger -> n8n Webhook)
3.  **TRIGGER (SUPABASE):** Un Trigger de PostgreSQL (`AFTER INSERT ON orders`) se activa automáticamente.
4.  **PUENTE:** La función del Trigger llama a un **Webhook de n8n** alojado en el VPS.
    -   *URL del Webhook a configurar en Supabase:* `https://n8n.tecnotitlan.mx/webhook/TU_WEBHOOK_ID_SECRETO`

#### ➡️ ETAPA 3: Automatización (n8n en cPanel)
5.  **WEBHOOK (n8n):** Recibe el ID del pedido y **ACTIVA** el Workflow.
6.  **SUPABASE:** Consulta la DB para obtener todos los detalles del pedido (productos, dirección, etc.).
7.  **MARKETPLACE/PROVEEDOR:** Nodo "HTTP Request" para enviar la orden de compra (dropshipping) a la API del proveedor.
8.  **WHATSAPP (Cliente):** Envía la confirmación del pedido al cliente (usando una Plantilla de Utilidad).
9.  **WHATSAPP (Admin):** Envía una notificación interna de "Nuevo Pedido" al número personal del administrador (Mensaje de Texto plano).
10. **SUPABASE:** Actualiza el estado del pedido a "Procesado" y guarda la guía de envío/rastreo recibida del proveedor.

### Aclaración sobre la Ejecución de Node.js

La gran ventaja de esta arquitectura es la forma en que se utiliza Node.js.

#### ⚙️ El Node.js Ejecutado es n8n (cPanel)

El código Node.js que necesita ejecutarse de forma continua (24/7) es el motor de **n8n**, ya que n8n es una aplicación desarrollada en Node.js. Al instalarlo en el servidor cPanel (aprovechando los 6 núcleos y 6GB de RAM), se está ejecutando una instancia persistente de Node.js que gestionará todos los workflows.

#### La División de la Lógica

-   **Frontend (Estático en cPanel):** El frontend es una SPA (Single Page Application) servida como archivos estáticos. Se ejecuta en el navegador del cliente y su función crítica es guardar el pedido inicial en Supabase.

-   **Node.js en el Backend (cPanel/n8n):** La instancia de n8n está siempre activa en el servidor. Esta instancia ejecuta el código Node.js necesario para:
    - Escuchar el Webhook de Supabase.
    - Conectarse a la base de datos para obtener detalles.
    - Enviar solicitudes a las APIs de los proveedores.
    - Gestionar el bot de WhatsApp.

### Estrategia de Desarrollo del Pipeline (n8n Local)

> **⚠️ NOTA:** Estrategia suspendida temporalmente. Se prioriza la configuración directa en el servidor de producción ("Desarrollo en Vivo").

Para construir y probar los workflows de n8n de forma segura y sin costo antes del despliegue, se utiliza un entorno de desarrollo local completamente integrado gracias a Docker.

#### 1. Ambiente Local (Tu PC)
-   **Software a Usar:** El archivo `docker-compose.yml` orquesta todos los servicios necesarios: el backend, la base de datos PostgreSQL y el motor de n8n.
-   **Costo:** $0 USD (solo el consumo de recursos de tu equipo).
-   **Función:** Construir y probar la lógica: conectar el nodo de Supabase, dar formato a los mensajes de WhatsApp y mapear el envío al proveedor.
-   **Limitación:** Los Webhooks no funcionarán, ya que tu IP local no es pública. Se debe usar el botón **"Execute Workflow"** manualmente para las pruebas.

#### 2. Conexión a Base de Datos Local (Persistencia)
-   **Acción:** La instancia de n8n que corre en Docker se conecta a la misma base de datos PostgreSQL (`tecnotitlan_postgres`) que utiliza el backend.
-   **Ventaja:** Todos los workflows y credenciales que crees se guardan en la base de datos local. Esto permite un desarrollo y prueba de integraciones completamente aislado.

#### Secuencia Recomendada
1.  **Instalar n8n Localmente:** Sigue la guía oficial para instalar la versión Desktop (la más fácil).
1.  **Levantar el Entorno Docker:** Ejecuta `docker-compose up` en la raíz del proyecto. Esto iniciará el backend, la base de datos y n8n.
2.  **Construir Workflows:** Accede a n8n en `http://localhost:5678` y crea todos los flujos necesarios (Pedido a WhatsApp, Actualización de Stock, etc.).
3.  **Verificar Lógica:** Ejecuta manualmente cada flujo para confirmar que se conecta a la base de datos local y procesa los datos correctamente.
4.  **Desplegar a Producción:** Solo cuando toda la lógica esté lista y probada, puedes exportar los workflows (como JSON) y desplegarlos en la instancia de producción (cPanel) que ya se conectará a la base de datos de producción (Supabase).

---

> **💡 NOTA CLAVE:** El motor de **n8n en cPanel** es el componente central que garantiza la ejecución 24/7 de la lógica crítica del negocio, aprovechando la velocidad superior del servidor.

---

## 12. Arquitectura de Roles y Permisos (Sistema RBAC)

Para lograr un control de acceso modular y flexible, se ha implementado un sistema de **Control de Acceso Basado en Roles (RBAC)**. Esto permite crear roles base (`SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `VENDEDOR`, `USER`) y ajustar permisos por usuario sin duplicar roles.

### Componentes Clave
- **Modelos de Datos:** `Role`, `Permission`, `UserPermissionGrant` y `UserPermissionDeny` estan definidos en `d:/Tecnotitlan/backend/prisma/schema.prisma`.
- **Seeding Inicial:** El script `d:/Tecnotitlan/backend/prisma/seed.js` crea los roles base, permisos operativos y el usuario `SUPER_ADMIN`.
- **Permisos por rol:** `RoleListScreen.js` permite administrar la matriz de permisos por rol. El rol base define lo que un grupo puede hacer normalmente.
- **Permisos por usuario:** `UserEditScreen.js` permite agregar excepciones individuales: `Si, permitir` para dar un permiso extra y `No, bloquear` para negar un permiso aunque venga heredado del rol.
- **Resumen operativo:** `UserListScreen.js` muestra si el usuario usa solo el rol base o si tiene overrides `+N` / `-N`, para detectar rapido usuarios con permisos especiales.
- **Protección de Rutas:** El middleware `d:/Tecnotitlan/backend/src/middleware/permissionMiddleware.js` (`checkPermission`) valida permisos en backend. `authMiddleware.js` reconstruye permisos efectivos en cada sesion combinando rol base, grants y denies.

### Reglas Operativas
- `SUPER_ADMIN` conserva acceso total y no debe depender de overrides individuales.
- `ADMIN` puede operar administracion amplia, pero no necesariamente debe tener acceso a configuraciones criticas si se decide restringirlo.
- `SUPERVISOR` debe poder revisar ventas, inventario, pedidos y seguimiento sin tocar secretos ni integraciones sensibles.
- `VENDEDOR` puede atender ventas, clientes, WhatsApp/Tecatl y pedidos, pero por defecto no debe ver costos, inversiones ni margenes internos.
- Los costos se protegen con permisos especificos como `finance:read_costs`; el acceso al panel se controla con `access:admin_panel`.

---

## 13. Arquitectura de Configuración de WhatsApp

La gestión de la conexión de WhatsApp se realiza desde el panel de administración, permitiendo vincular un dispositivo escaneando un código QR sin acceder a la terminal del servidor.

### Componentes Clave
- **Backend:** El servicio `whatsappService.js` y los endpoints de control en `index.js` gestionan la inicialización y el estado de la conexión mediante **Socket.IO**.
- **Inicialización:** Al arrancar el servidor (`npm start`), `index.js` inicializa `whatsappService` y le pasa la instancia de `io` (Socket.IO) para permitir la comunicación en tiempo real con el frontend (QR, estados).
- **Frontend:** La pantalla `WhatsappSettingsScreen.js` escucha estos eventos de WebSockets para mostrar el código QR y el estado de la conexión sin necesidad de recargar la página.
- **Atencion Operativa:** La pantalla `WhatsAppChatScreen.js` es la vista de trabajo para vendedores/supervisores. Debe mantener lista de conversaciones, mensajes y adjuntos dentro de contenedores con scroll interno para evitar que el panel se vuelva inmanejable en conversaciones largas.
- **Identidad de contactos:** Baileys puede entregar identificadores internos `@lid` en lugar del telefono real. El sistema solo debe mostrar como telefono los JID `@s.whatsapp.net` o el numero asociado por el evento `chats.phoneNumberShare`; los `@lid` se muestran como ID tecnico para evitar numeros falsos en atencion.
- **Scroll operativo:** El chat de WhatsApp solo debe hacer scroll automatico al fondo cuando el operador esta al final, cambia de conversacion o envia un mensaje. Si el operador esta revisando mensajes anteriores, las actualizaciones en vivo no deben regresarlo abajo.

---

## 14. Troubleshooting

### No puedo iniciar sesión como administrador (Error 401)

Si después de un despliegue nuevo no puedes iniciar sesión y recibes un error `401 Unauthorized` en la consola del navegador, las causas más probables son:

1.  **La base de datos está vacía:** La causa más común es que la base de datos de producción (Supabase) no tiene ningún usuario. La migración a cPanel implicó crear una base de datos nueva, y los usuarios no se migran automáticamente.
    -   **Solución:** Ejecuta el script de "seeding" para crear el usuario administrador por defecto y otros datos iniciales. Conéctate al servidor por SSH y ejecuta:
        ```bash
        # Dentro de la carpeta del backend, con el entorno de Node activado
        npm run seed:import
        ```
    -   Verifica las credenciales por defecto en el archivo `d:/Tecnotitlan/backend/prisma/seed.js`.

2.  **Conflicto con reCAPTCHA:** Si en la consola del navegador ves un aviso de `recaptcha key not provided`, puede que el backend esté requiriendo la validación pero el frontend no la esté enviando.
    -   **Solución a Largo Plazo:** Asegúrate de que las variables `REACT_APP_RECAPTCHA_SITE_KEY` (en el frontend) y `RECAPTCHA_SECRET_KEY` (en el backend) estén configuradas correctamente.
    -   **Prueba de Diagnóstico Rápida:** Para descartar que este sea el problema, puedes comentar temporalmente el middleware de `verifyCaptcha` en la ruta de login (`/api/users/login`) dentro del archivo `d:/Tecnotitlan/backend/src/routes/userRoutes.js`.
# Aviso de Privacidad Integral

**Última actualización:** Diciembre 2025

En cumplimiento con la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)** de México, **TECNOTITLÁN** (en adelante "El Sitio"), pone a su disposición el presente Aviso de Privacidad.

## 1. Identidad y Domicilio del Responsable
El responsable del tratamiento de sus datos personales es la administración de **TECNOTITLÁN**. Para efectos de este aviso, señalamos como medio de contacto nuestro formulario de atención al cliente y el correo electrónico de soporte visible en el sitio.

## 2. Datos Personales Recabados
Para procesar sus pedidos y brindarle servicio, recabamos los siguientes datos:
*   **Datos de Identificación:** Nombre completo.
*   **Datos de Contacto:** Correo electrónico, número de teléfono móvil, dirección de envío y facturación.
*   **Datos Financieros:** Información de pago procesada de forma encriptada a través de pasarelas seguras (PayPal, Stripe, Mercado Pago). **El Sitio NO almacena números completos de tarjetas de crédito.**

## 3. Finalidades del Tratamiento
Sus datos serán utilizados para las siguientes finalidades:
*   **Primarias (Necesarias):** Procesamiento, envío y entrega de pedidos; facturación; contacto para aclaraciones sobre el servicio.
*   **Secundarias:** Envío de promociones, boletines informativos y encuestas de calidad (puede darse de baja en cualquier momento).

## 4. Transferencia de Datos (Dropshipping)
Le informamos que, debido a nuestro modelo de operación logística, sus datos de envío (Nombre, Dirección, Teléfono) pueden ser compartidos con:
*   Proveedores logísticos y de paquetería (DHL, FedEx, Estafeta, etc.).
*   Almacenes y socios comerciales encargados del despacho de mercancía.

## 5. Derechos ARCO
Usted tiene derecho a **A**cceder, **R**ectificar, **C**ancelar u **O**ponerse al tratamiento de sus datos. Para ejercer estos derechos, envíe una solicitud a nuestro correo de soporte.
# Términos y Condiciones de Uso

**Bienvenido a TECNOTITLÁN.**

Al acceder y utilizar este sitio web, usted acepta estar sujeto a los siguientes términos y condiciones.

## 1. Generalidades
Este sitio es operado por **TECNOTITLÁN**. Nos reservamos el derecho de rechazar la prestación de servicio a cualquier persona, por cualquier motivo y en cualquier momento.

## 2. Productos y Servicios
*   **Disponibilidad:** Ciertos productos pueden estar disponibles exclusivamente en línea y tener cantidades limitadas.
*   **Precios:** Los precios de nuestros productos están sujetos a cambios sin previo aviso.

## 3. Envíos y Tiempos de Entrega (Modelo Dropshipping)
*   **Logística:** Trabajamos con proveedores nacionales e internacionales. Al realizar una compra, usted acepta que su pedido puede ser procesado y enviado directamente desde los almacenes de nuestros socios.
*   **Tiempos:** Los tiempos de envío son estimados y pueden variar según la ubicación y la temporada. El tiempo promedio de entrega es de **5 a 15 días hábiles**.

## 4. Política de Devoluciones
Nuestra política tiene una duración de **30 días** a partir de la recepción del producto. Para ser elegible, el artículo debe estar sin usar y en las mismas condiciones en que lo recibió.

## 5. Ley Aplicable
Estos Términos del Servicio se regirán e interpretarán de acuerdo con las leyes de **México**.

```
