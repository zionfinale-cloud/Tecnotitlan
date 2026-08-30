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

    - **Bot de WhatsApp:** Ruta operativa unica con **Baileys v7** y sesion cifrada en Supabase/PostgreSQL. La sesion se conserva entre redeploys usando `WHATSAPP_AUTH_STORAGE=database` y un `SESSION_SECRET` estable.
    - **Chatbot Web:** Sincronizado con el sistema para ofrecer soporte en tiempo real.
    - **Actualizacion WhatsApp 2026-07:** Se retira el proveedor externo de WhatsApp para evitar licenciamiento, dependencias extra y reconexiones confusas. Tecnotitlan usa el flujo estable tipo VEVA: una sola vinculacion, llaves cifradas en base de datos y reconexion controlada.
- **UI/UX:** Interfaz limpia, moderna y premium.
- **Canales oficiales Tecnotitlan:** Facebook `https://www.facebook.com/profile.php?id=61591872000643`, TikTok `https://www.tiktok.com/@tecnotitlan_mx` y WhatsApp operativo `+52 348 151 0949`.
- **Inventario operativo (2026-07-23):** La tienda debe mostrar piezas disponibles en tarjetas, detalle y carrito. Si `countInStock` es `0`, el producto se marca como agotado temporalmente y no puede avanzar al checkout. Las cancelaciones de pedidos que ya generaron salida de inventario regresan stock automaticamente si no existe evidencia real de envio (guia, paqueteria, link de rastreo o entrega registrada). Si el pedido ya tiene guia/rastreo o entrega, la cancelacion queda pendiente de confirmacion de recepcion del producto antes de regresar inventario. Los cortes descuentan las reversas `RETURN_IN` con `referenceType=ORDER_CANCEL` para no inflar ventas ni utilidad.

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

### 2026-08-11 - Endurecimiento de WhatsApp/Baileys

- Se confirmo que existe un solo servicio de WhatsApp y un solo arranque automatico.
- Cada envio usa un unico destinatario validado; se retiro el fallback mexicano `521` y los intentos sobre multiples JID.
- Un envio fallido ya no cierra, reconecta ni reenvia dentro de la misma operacion.
- El codigo `463` se considera sensible: pausa la integracion para proteger el numero y exige revision manual.
- Los chats `@lid` se conservan y los numeros normales se resuelven una sola vez mediante Baileys.

## Media Por SKU Y Ficha De Producto (2026-07-29)

- Los archivos se cargan primero de forma temporal y, al guardar el producto, se organizan con su SKU definitivo en `/app/uploads/<PREFIJO>/<SKU>/`.
- El nombre de cada imagen usa un indice incremental (`<SKU>-01`, `<SKU>-02`, etc.). Reordenar la galeria conserva las rutas actuales; nuevas cargas se agregan sin sobrescribir archivos existentes.
- La API publica los archivos desde `/uploads` y en produccion debe conservar el volumen persistente montado en `/app/uploads`.
- La ficha publica separa galeria, compra, descripcion y especificaciones. Las etiquetas internas de Tecatl no se muestran al cliente.
- El video del producto se reproduce integrado en la galeria cuando la fuente permite embeberse (YouTube, TikTok o archivo de video directo).

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
    SESSION_SECRET=secreto_estable_para_cifrar_whatsapp_no_rotar_sin_cerrar_sesion
    
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
    MERCADOLIBRE_REDIRECT_URI=https://api.tecnotitlan.com.mx/api/mercadolibre/callback
    WHATSAPP_PROVIDER=baileys
    WHATSAPP_AUTH_STORAGE=database
    WHATSAPP_AUTO_CONNECT=true
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
-   **WhatsApp:** Integrado con Baileys y sesion cifrada en PostgreSQL. El backend mantiene reconexion controlada y no depende de un proveedor externo adicional.
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

> **Nota sobre WhatsApp:** La ruta vigente es Baileys con `WHATSAPP_AUTH_STORAGE=database`. La sesion y llaves viven cifradas en PostgreSQL y el volumen `/app/auth_info_baileys` queda como apoyo local. No cambiar `SESSION_SECRET` mientras exista una sesion vinculada.

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
- **Proveedor WhatsApp:** `WHATSAPP_PROVIDER=baileys` es la ruta operativa recomendada. `WHATSAPP_PROVIDER=disabled` queda como freno de emergencia cuando el numero este restringido o se quiera pausar WhatsApp sin romper ventas/correos.
- **Sesion Baileys persistente tipo VEVA:** con `WHATSAPP_AUTH_STORAGE=database`, la sesion y llaves de mensajes se guardan cifradas en Supabase/PostgreSQL (`whatsapp_auth_state`) usando `SESSION_SECRET`. Los archivos de `WHATSAPP_AUTH_DIR` quedan como compatibilidad, no como fuente principal.
- **Decision operativa actual:** usar `WHATSAPP_PROVIDER=baileys`, `WHATSAPP_AUTH_STORAGE=database` y `WHATSAPP_AUTO_CONNECT=true`. No cambiar `SESSION_SECRET` sin cerrar primero la sesion de WhatsApp, porque las llaves cifradas no podran descifrarse.
- **Reconexiones Baileys:** el backend usa backoff controlado como VEVA. Si se agotan los intentos, queda en `DISCONNECTED` y el watchdog puede volver a intentar con calma. Si WhatsApp pide QR durante un autoconnect, queda en `QR_REQUIRED`; si responde `loggedOut`, `bad session` o `multidevice mismatch`, queda en `LOGGED_OUT`. En esos casos **no se genera QR ni se rota credencial automaticamente**. La reconexion con QR debe ser manual desde `Configuracion > WhatsApp QR`.
- **Panel de atencion WhatsApp:** la pantalla de chat muestra proveedor/estado de conexion antes de enviar. Si Baileys recibe conversaciones con identificadores internos de WhatsApp (`@lid`), el backend conserva la conversacion original y, al enviar, intenta usar el JID principal y despues el telefono asociado cuando exista. Si no hay sesion activa, el panel bloquea el envio y muestra un error claro.
- **Notificaciones transaccionales:** Antes de omitir un aviso por WhatsApp, el backend puede intentar reconectar usando la sesion persistente y esperar unos segundos. Si la sesion esta invalida, fue cerrada desde el telefono o WhatsApp fuerza reautenticacion, el sistema marca `QR_REQUIRED`/`LOGGED_OUT` y el QR se solicita manualmente desde Configuracion > WhatsApp. Los pedidos nunca deben fallar por WhatsApp desconectado; correo e inventario siguen su flujo y el evento queda en logs.
- **Connection Failure:** Cuando Baileys cierra con `Connection Failure`, el log debe incluir `StatusCode`. Si es una caida recuperable, el backend reintenta. Si el codigo/mensaje indica logout o sesion invalida, el backend detiene la reconexion automatica y exige intervencion manual para evitar bloqueos por reintentos repetidos.
- **Atencion Operativa:** La pantalla `WhatsAppChatScreen.js` es la vista de trabajo para vendedores/supervisores. Debe mantener lista de conversaciones, mensajes y adjuntos dentro de contenedores con scroll interno para evitar que el panel se vuelva inmanejable en conversaciones largas.
- **Identidad de contactos:** Baileys puede entregar identificadores internos `@lid` en lugar del telefono real. El sistema solo debe mostrar como telefono los JID `@s.whatsapp.net` o el numero asociado por el evento `chats.phoneNumberShare`; los `@lid` se muestran como ID tecnico para evitar numeros falsos en atencion.
- **Scroll operativo:** El chat de WhatsApp solo debe hacer scroll automatico al fondo cuando el operador esta al final, cambia de conversacion o envia un mensaje. Si el operador esta revisando mensajes anteriores, las actualizaciones en vivo no deben regresarlo abajo.

---

## 14. Flujo Operativo de Pedidos e Inventario

El flujo base para operar ventas reales queda definido asi:

1. El cliente crea el pedido desde la web.
2. El pago se confirma por Stripe, transferencia/SPEI, Mercado Libre o WhatsApp.
3. Al confirmarse el pago, el backend intenta registrar automaticamente la salida de inventario para productos `IN_HOUSE`.
4. Si la salida de inventario falla por falta de stock o inconsistencia, el pedido conserva el pago confirmado, pero registra una alerta en el historial: `salida de inventario requiere revision manual`.
5. En `Pedidos`, el administrador o usuario con `order:update` ve una alerta visible y puede usar `Reintentar inventario` despues de corregir stock.
6. El reintento usa `PUT /api/orders/:id/retry-inventory`, respeta idempotencia por pedido/producto y no duplica salidas ya registradas.
7. Al registrar guia, el pedido pasa a `SHIPPED` y se envia correo y WhatsApp al cliente.
8. Al marcar como entregado, el pedido pasa a `DELIVERED` y se envia correo final y WhatsApp de cierre.
9. Si el pago entra por Stripe webhook, el historial del pedido debe registrar tambien `Pago confirmado con tarjeta` para que el cliente nunca vea un pedido pagado como si siguiera pendiente.
10. Si el cliente o un administrador cancela antes de envio real, el sistema restaura inventario y solicita reembolso automatico en Stripe cuando el pago fue con tarjeta.
11. Si el pedido ya tiene guia, paqueteria, link de rastreo, `SHIPPED` o `DELIVERED`, la cancelacion queda en revision: no se regresa inventario ni se reembolsa automaticamente hasta confirmar recepcion/devolucion.

Reglas importantes:

- Nunca se debe descontar inventario si el pedido no esta pagado.
- Las salidas de inventario por pedido usan `referenceType = ORDER` y `referenceId = order.id`.
- Si Stripe webhook y frontend confirman el mismo pago, `orderInventoryService.js` evita duplicar movimientos `SALE`.
- Las cancelaciones pagadas con tarjeta usan `stripeRefundService.js`: busca el Payment Intent del pedido, solicita refund en Stripe, guarda el resultado en `paymentResult.refund` y deja nota visible en la linea de tiempo.
- Al confirmarse pago, envio, entrega o cancelacion, el backend intenta notificar por correo y WhatsApp. Si WhatsApp esta desconectado o el pedido no tiene telefono, el pedido no se bloquea: se registra el aviso en logs para revision operativa.
- Los correos y WhatsApp al cliente deben incluir enlace directo a `/order/:id` para que pueda revisar estado, productos, guia y notas de reembolso.
- La pantalla de `Pedidos` es el centro operativo para confirmar pago, registrar guia, marcar entregado y corregir salidas pendientes.

### Separacion de Inversion e Inventario

- **Inversiones:** representan dinero disponible para operar. Una inversion puede iniciar con un monto, recibir entradas extra y registrar salidas de dinero como gastos operativos, imprevistos o retiros.
- **Compras de inventario:** cuando se registra una entrada de mercancia ligada a una inversion, el monto de la compra reduce el disponible de esa inversion.
- **Eliminacion segura de inversiones:** una inversion se puede eliminar desde el panel solo si no tiene movimientos de dinero ni entradas de inventario ligadas. Si ya pago mercancia, gastos o ajustes, el backend bloquea el borrado para proteger cortes, utilidad y trazabilidad.
- **Gastos operativos:** gasolina, empaques, comisiones, material de envio, herramientas o imprevistos se registran como movimientos de dinero en `Inversiones`, no como inventario.
- **Inventario:** representa piezas fisicas y ubicacion. Debe responder: que tengo, donde esta, que se envio a canal, que se vendio y que falta reponer.
- **Movimientos de inventario:** entradas, salidas por venta, transferencias a marketplaces y ajustes viven en `InventoryMovement`.
- **Movimientos de dinero:** entradas extra, gastos operativos, imprevistos y salidas viven en `InvestmentCashMovement`.
- **UX operativa:** `Inversiones` debe permitir filtrar movimientos de dinero por inversion, tipo y fecha. `Inventario` debe mostrar resumen rapido de entradas, ventas, envios a canal y ajustes, con botones de auditoria rapida para evitar depender de tablas largas.
- **Separacion visual en Inventario:** el historial operativo no debe mostrarse como una sola tabla mezclada. Debe separarse en `Entradas de mercancia`, `Salidas por venta`, `Traspasos a canales` y `Ajustes/devoluciones`. Asi se distingue claramente lo comprado, lo vendido y lo enviado/apartado para Mercado Libre, TikTok Shop o Amazon.
- **Submenus operativos de Inventario:** la pantalla de `Inventario` queda organizada por pestañas: `Resumen`, `Entradas`, `Salidas`, `Traspasos` e `Historial`. Entradas registra compras/recepcion de mercancia; Salidas registra ventas manuales; Traspasos mueve stock desde bodega/web hacia Mercado Libre, TikTok Shop o Amazon; Historial concentra auditoria y filtros.
- **Submenus operativos de Pedidos:** la pantalla de `Pedidos` separa `Activos` y `Completados`. Los pedidos entregados o cancelados se consultan en completados para mantener despejada la vista diaria de preparacion, guia y seguimiento.
- **Regla de trabajo diario:** primero se registra el dinero disponible o gasto en `Inversiones`; despues se registran las piezas en `Inventario`; al vender o mover a canal, se registra la salida fisica. Esta separacion evita perder dinero, duplicar stock o mezclar gasto operativo con mercancia.

### Regla de inventario real vs publicado

El resumen de inventario toma como fuente de verdad los movimientos reales (`InventoryMovement`). `Bodega/Web` viene de `Product.countInStock`; Mercado Libre, TikTok Shop y Amazon solo cuentan como stock asignado si existe un `CHANNEL_TRANSFER`, venta, devolucion o ajuste de ese canal. El `publishedStock` de una publicacion marketplace es informativo y no debe contarse como mercancia fisica si no hubo traspaso registrado. Si el dashboard muestra `Publicado desfasado`, significa que el marketplace aun tiene un stock configurado diferente al stock asignado real y debe sincronizarse o corregirse antes de vender en ese canal.

### Flujo financiero simple

La inversion representa dinero operativo disponible. Ejemplo: si se inicia con $15,000 y se compran 5 auriculares de $100, el sistema registra una entrada de inventario por $500 y el disponible de la inversion baja a $14,500. Si esos auriculares se venden en $250, la venta registra ingreso por $1,250, costo vendido por $500 y utilidad bruta por $750. Gastos como impresoras, gasolina, empaques o imprevistos se registran en `Inversiones` como salida de dinero, no como inventario. Cuando Mercado Libre, TikTok Shop, Amazon o la web depositen dinero, debe registrarse como entrada/recuperacion de dinero en la inversion o corte correspondiente para separar caja, costo y utilidad.

Antes de vender o mandar mercancia a un canal, siempre debe existir una entrada de inventario. Si se compran 6 piezas y se decide dejar 2 en bodega/web, 2 en Mercado Libre y 2 en TikTok Shop, primero se registra la entrada de 6; despues se hacen traspasos de 2 a Mercado Libre y 2 a TikTok Shop. Las ventas posteriores se registran en el canal donde ocurrieron y descuentan ese stock asignado.

### Uso recomendado de n8n

n8n debe implementarse despues de estabilizar el flujo humano base. Su primer uso recomendado no es modificar inventario automaticamente, sino avisar y acompañar:

1. Alertar bajo stock por canal o producto.
2. Notificar pedidos pagados, enviados o entregados.
3. Crear tareas internas para reabasto.
4. Mandar mensajes de seguimiento al cliente cuando exista guia.
5. Reportar cortes diarios/semanales al administrador.

Regla: n8n puede avisar y preparar acciones; los movimientos criticos de dinero/inventario deben quedar registrados primero por Tecnotitlan para mantener auditoria.

Para iniciar n8n sin riesgo, los primeros workflows deben ser:

1. Alerta interna cuando un producto quede debajo del stock de seguridad.
2. Reporte diario de ventas, utilidad bruta y productos vendidos.
3. Aviso de pedidos pagados pendientes de guia.
4. Aviso de paquetes enviados sin marcar como entregados despues de X dias.
5. Resumen de gastos operativos e imprevistos de la semana.

### Etiquetas operativas para Tecatl

Tecatl no debe adivinar solo por el nombre del producto. Para que pueda recomendar por necesidad real del cliente, las `Especificaciones / caracteristicas` del producto tambien funcionan como etiquetas semanticas.

Campos recomendados al crear productos:

- **Uso recomendado:** viaje, oficina, escuela, auto, gaming, emergencia.
- **Etiquetas Tecatl:** bateria, audio, regalo, usb-c, bluetooth, carga rapida, compacto.
- **Compatibilidad:** Android, iPhone, USB-C, Lightning, Bluetooth, laptop, tablet.
- **Ideal para:** personas que viajan, estudiantes, repartidores, oficina, clientes que necesitan respaldo de energia.

Ejemplo: si un cliente escribe "voy a viajar, que me recomiendas?", Tecatl busca en nombre, descripcion, categoria, marca, SKU y caracteristicas. Si un powerbank tiene `Uso recomendado: viaje` y `Etiquetas Tecatl: bateria, carga, emergencia`, el asistente puede sugerirlo aunque el cliente nunca escriba "powerbank".

Regla: antes de publicar un producto, debe tener descripcion comercial, imagenes y al menos 3 caracteristicas utiles para cliente y para Tecatl. Esto mejora busqueda, recomendaciones y soporte sin crear una tabla extra de etiquetas.

En el formulario de producto, las etiquetas principales se seleccionan como chips y se guardan dentro de la caracteristica `Etiquetas Tecatl`. Tambien se pueden agregar etiquetas personalizadas. Estas etiquetas son internas: Tecatl las usa para buscar, recomendar y contestar preguntas de seguimiento, pero no debe mostrarlas al cliente como ficha publica. Por ejemplo, si un producto tiene `Etiquetas Tecatl: usb-c, viaje, audio`, el cliente no debe ver "Etiquetas Tecatl"; solo debe recibir una respuesta natural como "si, maneja carga USB-C / Tipo C" cuando pregunte por compatibilidad.

### Mercado Libre - fase 2 manual-controlada

Mercado Libre queda conectado como marketplace externo, pero el control maestro sigue en Tecnotitlan. Si la pantalla de pedidos muestra `0 pedidos`, no significa por si solo que la conexion este rota: normalmente significa que la cuenta autorizada no tiene ordenes recientes disponibles para la app, o que todavia no se ha vendido desde Mercado Libre. Antes de automatizar importaciones, se trabaja con vinculacion manual de publicaciones y sincronizacion supervisada de stock.

Configuracion requerida:

- `MERCADOLIBRE_APP_ID`
- `MERCADOLIBRE_CLIENT_SECRET`
- `MERCADOLIBRE_REDIRECT_URI=https://api.tecnotitlan.com.mx/api/mercadolibre/callback`

Pantalla operativa:

- Ruta admin: `/admin/settings/mercadolibre`
- Redirect URI para Mercado Libre Developers: `https://api.tecnotitlan.com.mx/api/mercadolibre/callback`
- Webhook/notificaciones: `https://api.tecnotitlan.com.mx/api/mercadolibre/notifications`

Backend disponible:

- `GET /api/mercadolibre/status`: muestra configuracion y conexion sin exponer tokens.
- `GET /api/mercadolibre/auth-url`: genera URL OAuth con PKCE para conectar la cuenta.
- `GET /api/mercadolibre/callback`: recibe el codigo, guarda token y redirige al admin.
- `GET /api/mercadolibre/orders`: lee pedidos recientes con el token vigente, intenta importarlos a `Pedidos` y devuelve el resultado de importacion por orden.
- `GET /api/mercadolibre/webhook-events`: muestra la bitacora reciente de webhooks recibidos en el endpoint de Mercado Libre.
- `GET /api/mercadolibre/items/:meliItemId`: revisa una publicacion vinculada.
- `PUT /api/products/:sku/link-meli`: vincula un producto local con una publicacion real de Mercado Libre. Tambien acepta el ID interno del producto para compatibilidad.
- `GET /api/mercadolibre/publication-requirements` y `POST /api/products/:referencia/publish-meli`: preparan y publican desde la ficha de Tecnotitlan. La referencia puede ser el SKU maestro o el ID interno; el panel usa normalmente el SKU (`AUR-002`, por ejemplo).
- `PUT /api/mercadolibre/products/:sku/sync`: actualiza stock en la publicacion vinculada.

Flujo operativo actual para una publicacion nueva:

1. Crear el producto maestro en Tecnotitlan con SKU interno, imagenes, costo, precio y datos comerciales.
2. Registrar la entrada fisica en `Inventario > Entradas`; la mercancia entra primero a `Bodega/Web`.
3. Traspasar a Mercado Libre solamente las piezas que se desean ofrecer en ese canal y definir el buffer de seguridad.
4. En la ficha del producto, abrir `Mercado Libre`, preparar la publicacion y completar categoria, atributos obligatorios, condicion, imagenes y tipo de publicacion.
5. Pulsar `Publicar en Mercado Libre`. Tecnotitlan crea el anuncio mediante la API.
6. Mercado Libre devuelve el item ID (`MLM...`) y la URL; Tecnotitlan los guarda automaticamente en el producto y en su vinculacion de marketplace.
7. Tecnotitlan publica y mantiene sincronizada la cantidad `asignado a Mercado Libre - buffer`.
8. Los webhooks reciben ventas y movimientos. `Leer pedidos` queda como herramienta manual de recuperacion o diagnostico, no como parte del trabajo diario.

El campo para escribir un ID `MLM...` es una opcion avanzada y se usa exclusivamente cuando el anuncio ya fue creado fuera de Tecnotitlan, por ejemplo desde Seller Center. No se debe solicitar ese ID para una publicacion nueva creada desde Tecnotitlan.

Regla de seguridad: Mercado Libre no inventa pedidos ni inventario. Cuando `Leer pedidos` o un webhook real de Mercado Libre encuentra una orden pagada, Tecnotitlan intenta convertirla en un pedido interno con folio `MELI-{id}`. Para poder importarla, cada producto de la orden debe empatar con un producto local mediante `meliItemId`, vinculacion de `MarketplaceListing`, SKU o coincidencia clara de titulo. Si no se puede empatar, la orden queda como `Requiere revision` en la pantalla de Mercado Libre y en la bitacora, sin crear pedido fantasma ni tocar inventario.

Cuando una orden se importa correctamente:

1. Se crea o reutiliza un cliente Mercado Libre interno para trazabilidad.
2. Se crea el pedido con `salesChannel=MERCADOLIBRE`, `paymentMethod=Mercado Libre` y folio `MELI-{id}`.
3. Si el pago viene confirmado, el estado inicial queda como `PENDING_FULFILLMENT` / Por surtir.
4. Se valida que exista stock asignado a Mercado Libre por traspasos reales de inventario.
5. Si hay stock suficiente, se registra una salida `SALE` con canal `MERCADOLIBRE`.
6. Si falta stock asignado, el pedido se crea con advertencia de inventario para revision operativa, pero no descuenta bodega ni inventa existencia.
7. Se notifican las ventas pagadas al equipo operativo mediante las preferencias de notificacion configuradas: correo, WhatsApp o ambos.

La pantalla `/admin/settings/mercadolibre` muestra dos niveles: la orden leida desde Mercado Libre y el resultado de importacion. `Importado a pedidos` significa que ya debe aparecer en `Pedidos`; `Ya existia` significa que el folio ya estaba creado; `Requiere revision` significa que falta vincular la publicacion/SKU o corregir stock asignado; `Error al importar` indica fallo tecnico a revisar en logs.

#### Vinculacion asistida de ventas pendientes

Cuando Mercado Libre entrega una orden cuyo item no esta vinculado a un SKU local, Tecnotitlan conserva la orden externa para auditoria, pero no crea el pedido interno, no descuenta inventario y no envia una notificacion de venta. Esto evita ventas fantasma y movimientos sobre el producto equivocado.

La correccion se realiza en la misma pantalla `/admin/settings/mercadolibre`:

1. Presionar `Leer pedidos`.
2. En `Ventas pendientes de vincular`, identificar la publicacion recibida por titulo e ID `MLM...`.
3. Seleccionar el producto maestro correcto de Tecnotitlan.
4. Presionar `Vincular e importar`.

El vinculo se guarda en `Product.meliItemId` y en `MarketplaceListing`, por lo que solo se declara una vez. Despues, el sistema vuelve a leer las ordenes pendientes de forma idempotente: reutiliza la auditoria externa, crea un unico pedido `MELI-{id}`, valida y descuenta el stock asignado a Mercado Libre cuando corresponde, y notifica al equipo por los canales habilitados. Repetir `Leer pedidos` no duplica el pedido, el movimiento de inventario ni la notificacion.

Si la publicacion ya esta vinculada a otro producto, el sistema rechaza el cambio para evitar mezclar catalogos. Si la orden puede vincularse pero falta stock asignado al canal, el pedido se crea y queda visible con una advertencia operativa; no se inventa existencia ni se descuenta stock de bodega.

Nota de sandbox Mercado Pago/Mercado Libre: el simulador de Mercado Pago puede enviar eventos como `payment.updated`, `test.created` o `application.authorized` al mismo endpoint y recibir `200 OK`. Eso solo confirma que Tecnotitlan recibio el POST. No significa que exista una orden importable de Mercado Libre. Para crear o revisar pedidos de Mercado Libre el webhook debe traer formato de marketplace (`topic` y `resource`) o se debe leer la orden con el token de vendedor. Los eventos de Mercado Pago recibidos en este endpoint quedan en la bitacora como `Recibido / omitido` para auditoria, sin tocar inventario ni pedidos.

### Alerta de recompra operativa

El campo `Recompra` del inventario no representa una compra ya realizada; es una alerta de reposicion. Se activa cuando el stock fisico total del producto queda igual o debajo del minimo operativo (`reorderPoint`, actualmente 3 piezas). El dashboard debe mostrar el SKU, nombre, stock actual y cantidad sugerida a comprar para que el equipo sepa exactamente que producto reponer.

Ejemplo: si `AUR-001 - Auriculares Inalabrico` queda con 1 pieza total, el sistema muestra `Comprar 9` para regresar al objetivo operativo de 10 piezas. Si ademas existe stock publicado desfasado en Mercado Libre, TikTok Shop o Amazon, se muestra como informacion separada; stock publicado no equivale a mercancia fisica disponible.

### Mercado Libre - traspaso y sincronizacion de stock

El traspaso desde `Inventario > Traspasos` es el acto operativo de mover piezas desde `Bodega/Web` hacia un canal externo. Para Mercado Libre la regla queda asi:

1. La entrada de mercancia aumenta primero `Product.countInStock` (bodega/web).
2. Un traspaso a `MERCADOLIBRE` descuenta bodega/web y aumenta el stock asignado del canal en `MarketplaceListing.publishedStock`.
3. Si el producto ya tiene `meliItemId`, Tecnotitlan intenta sincronizar automaticamente la cantidad publicable en Mercado Libre.
4. La cantidad publicable es `stock asignado al canal - buffer de seguridad`, nunca el stock total de bodega/web.
5. Si el producto no tiene `meliItemId`, el traspaso queda registrado localmente, pero la publicacion queda pendiente de crear o vincular desde el producto/canal.

El traspaso por si solo no crea la publicacion porque antes deben confirmarse categoria, atributos obligatorios, condicion, precio, imagenes, envio, garantia y reglas comerciales. El flujo controlado es: `Traspasar stock` -> `Preparar publicacion` -> `Confirmar datos` -> `Publicar desde Tecnotitlan` -> `Guardar MLM automaticamente` -> `Sincronizar stock`. `Vincular publicacion existente` solo aplica a anuncios creados previamente fuera de Tecnotitlan.

Regla conversacional: si Tecatl recomienda un SKU y el cliente pregunta despues algo como "es tipo C?", "sirve para viaje?" o "es bluetooth?", Tecatl debe usar el contexto reciente de la conversacion y las caracteristicas/etiquetas internas del producto. Si la ficha no trae ese dato, entonces si debe pedir confirmacion humana para no inventar informacion.

### Tecatl en WhatsApp y escalacion humana 2026-07-23

Tecatl queda integrado como primera linea de atencion para WhatsApp. Cuando entra un mensaje de cliente por WhatsApp, el backend guarda el mensaje en el panel operativo, lo procesa con Tecatl y responde desde el mismo numero conectado.

Reglas:

- Tecatl puede contestar preguntas de productos, pedidos, pagos, envios, garantias y datos generales usando la base de conocimiento, el catalogo, caracteristicas y contexto reciente de la conversacion.
- Tecatl debe sostener conversacion normal antes de escalar: saludos, agradecimientos, confirmaciones cortas, dudas vagas y preguntas como "como estas?" no crean `ConversationHandoff`. En esos casos responde natural, pide contexto util o guia al cliente hacia producto, pedido, envio, garantia, pago o compatibilidad.
- Si una conversacion ya esta en `HUMAN_REQUIRED`, los mensajes nuevos del cliente se agregan al mismo seguimiento y Tecatl responde con acuse breve. No debe crear handoffs duplicados ni repetir siempre el mismo mensaje.
- Tecatl no debe inventar datos. Si no encuentra una respuesta confiable, marca la conversacion como `HUMAN_REQUIRED`, crea un `ConversationHandoff` y avisa al equipo.
- Las escalaciones se notifican a usuarios operativos (`SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `VENDEDOR`) segun sus preferencias: correo, WhatsApp o ambos.
- Si no hay destinatarios de WhatsApp configurados, el sistema usa `ADMIN_WHATSAPP_NUMBER` como respaldo cuando exista.
- Horario operativo humano: 9:00 a.m. a 7:00 p.m. hora de Mexico. Si la consulta llega despues de las 7:00 p.m. o antes de las 9:00 a.m., Tecatl responde que ya quedo registrada para seguimiento a primera hora y notifica al equipo.
- Los mensajes del equipo enviados desde el panel de Tecatl se mandan realmente por WhatsApp cuando la conversacion viene de WhatsApp. No solo se guardan en la base de datos.
- Cada escalacion y fallo de procesamiento queda registrado en `NotificationLog` para auditoria operativa.
- El panel de Tecatl separa conversaciones activas, WhatsApp, cerradas y las que requieren humano para que ventas no tenga que revisar todo mezclado.
- Tecatl solo procesa chats directos de cliente; grupos, estados, broadcasts y newsletters se ignoran para evitar respuestas automaticas fuera de contexto.
- Tecatl no responde mensajes `fromMe` enviados desde el mismo WhatsApp vinculado a Tecnotitlan. Esto es intencional para evitar bucles y autorespuestas. Para probar Técatl por WhatsApp, se debe escribir desde otro numero de cliente hacia el numero conectado; los mensajes verdes enviados desde el numero operativo no disparan respuesta automatica.

Objetivo de servicio: Tecnotitlan no solo vende producto; vende seguimiento. Si el bot no resuelve, el cliente debe sentir que alguien real ya tomo el caso.

### WhatsApp operativo - decision actual 2026-07

El numero operativo de WhatsApp quedo restringido/baneado despues de multiples reconexiones. La regla de seguridad sigue siendo: **no insistir con un numero restringido**. Para volver a operar WhatsApp se debe usar un numero recuperado o sano y vincularlo una sola vez con el flujo estable tipo VEVA.

Variables recomendadas para el modo estable:

- `WHATSAPP_PROVIDER=baileys`
- `WHATSAPP_AUTH_STORAGE=database`
- `SESSION_SECRET=valor_largo_estable_no_rotar`
- `WHATSAPP_AUTH_DIR=/app/auth_info_baileys`
- `WHATSAPP_AUTO_CONNECT=true`
- `WHATSAPP_MAX_RECONNECT_ATTEMPTS=1`
- `WHATSAPP_RECONNECT_BASE_DELAY_MS=300000`
- `WHATSAPP_RECONNECT_MAX_DELAY_MS=1800000`
- `WHATSAPP_PROTECTED_PAUSE_MS=10800000` opcional; por defecto son 3 horas de pausa protegida despues de errores peligrosos.
- `WHATSAPP_KEEP_ALIVE_INTERVAL_MS=300000`
- `WHATSAPP_PAUSED_RETRY_AFTER_MS=600000`
- `WHATSAPP_AUTO_RETRY_PAUSED=false`
- `WHATSAPP_AUTO_ROTATE_SESSION_ON_LOGOUT=false`
- `WHATSAPP_SESSION_LOCK_STALE_MS=120000`
- `WHATSAPP_SESSION_LOCK_HEARTBEAT_MS=15000`

Operativa inmediata si el numero sigue castigado: usar `WHATSAPP_PROVIDER=disabled` y `WHATSAPP_AUTO_CONNECT=false` como modo de emergencia. En este modo el backend no genera QR, no inicia Baileys y no manda mensajes por WhatsApp. Los correos transaccionales, cambios de estado, inventario y pedidos deben seguir funcionando.

Proteccion anti-baneo: si `WHATSAPP_AUTO_CONNECT=false`, el backend tampoco intenta levantar WhatsApp desde notificaciones de pedido. Los reintentos automaticos quedan limitados por defecto a 1 intento, con espera inicial de 5 minutos y maxima de 30 minutos. Si la sesion requiere QR nuevo (`QR_REQUIRED`) o fue cerrada/invalidada (`LOGGED_OUT`), no se reintenta solo ni se genera QR automatico.

Regla de seguridad: un numero restringido no se vuelve a escanear, reiniciar ni "rescatar" con cambios de proveedor. Eso aumenta el riesgo de baneo permanente. Para volver a usar WhatsApp hay dos rutas aceptables:

1. Numero recuperado o nuevo de WhatsApp Business, calentado manualmente con uso humano real antes de conectarlo.
2. Baileys con `WHATSAPP_AUTH_STORAGE=database`, igual que VEVA, para guardar sesion y llaves cifradas en PostgreSQL.
3. WhatsApp Cloud API oficial de Meta, recomendada para produccion cuando Tecnotitlan ya tenga credenciales y plantillas aprobadas.

### WhatsApp con Baileys y sesion cifrada

Despues de las restricciones provocadas por reconexiones repetidas, Tecnotitlan deja Baileys como ruta operativa oficial:

- `WHATSAPP_PROVIDER=disabled`: modo seguro de emergencia. No intenta conectar ni enviar por WhatsApp.
- `WHATSAPP_PROVIDER=baileys`: modo recomendado. Con `WHATSAPP_AUTH_STORAGE=database`, guarda sesion cifrada en PostgreSQL; con `WHATSAPP_AUTH_STORAGE=file`, usa archivos persistentes en `WHATSAPP_AUTH_DIR`.

Nota: los valores guardados en `Configuracion -> Sistema` se cargan desde base de datos y pueden ganar sobre el `.env`. Para el modo estable, confirmar que no exista un setting viejo con `WHATSAPP_PROVIDER=disabled` o `WHATSAPP_AUTH_STORAGE=file` si se espera usar PostgreSQL cifrado.

Variables recomendadas:

- `WHATSAPP_PROVIDER=baileys`
- `WHATSAPP_AUTH_STORAGE=database`
- `SESSION_SECRET`: secreto estable para cifrar la sesion. No rotarlo mientras exista una sesion vinculada.
- `SESSION_SECRET` puede vivir como variable de entorno de la API o como configuracion sensible en `Configuracion -> Sistema`, visible solo para Super Admin. No debe guardarse en `frontend/env.js`, archivos publicos del navegador ni commits de Git, porque expondria la sesion cifrada de WhatsApp.
- `WHATSAPP_AUTH_DIR=/app/auth_info_baileys`
- `WHATSAPP_AUTO_CONNECT=true`
- `WHATSAPP_MAX_RECONNECT_ATTEMPTS=1`
- `WHATSAPP_RECONNECT_BASE_DELAY_MS=300000`
- `WHATSAPP_RECONNECT_MAX_DELAY_MS=1800000`
- `API_PUBLIC_URL`: URL pública del backend, normalmente `https://api.tecnotitlan.com.mx`.

Flujo recomendado:

1. Configurar las variables anteriores en `Configuracion -> Sistema`.
2. Guardar configuracion y redeplegar/reiniciar la API.
3. Entrar a `Configuracion -> WhatsApp QR`.
4. Presionar `Iniciar conexion`.
5. Si ya existe sesion guardada, debe reconectar sin QR. Si no existe sesion, escanear el QR desde WhatsApp una sola vez.
6. Esperar a que el estado marque conectado y validar que la sesion se guarde en PostgreSQL.
7. Probar desde el panel `WhatsApp`: enviar texto, enviar imagen y recibir un mensaje entrante.

Regla operativa: las notificaciones de pedido por WhatsApp solo se envian si Baileys reporta la sesion conectada. Si no esta conectada, el sistema registra el aviso omitido en logs y no bloquea la compra ni el correo transaccional. El QR no se debe regenerar como rutina diaria; `Borrar sesion y pedir QR` solo se usa cuando se cambia de numero o cuando la sesion ya fue invalidada manualmente.

Regla anti-baneo 2026-07-17: el auto-connect, watchdog, reconexiones y notificaciones nunca deben generar QR nuevo. Esos procesos solo intentan conectar cuando ya existe una sesion guardada (`hasSavedSession=true`). Si no hay sesion guardada, el backend queda en `DISCONNECTED` y pide iniciar manualmente desde `Configuracion -> WhatsApp QR`. El QR solo puede aparecer por accion humana: `Iniciar conexion` cuando no hay sesion o `Borrar sesion y pedir QR` cuando se va a vincular un numero sano.

Regla anti-baneo 2026-07-28: solo cierres que indican sesion invalida o riesgo real (`401`, `403`, `411`, `500`, `loggedOut`, `bad session`, `multidevice mismatch`, `rate limit` o QR inesperado durante autoconexion) activan `PAUSED` y guardan `WHATSAPP_PROTECTED_PAUSED_UNTIL` en la tabla `settings`. Mientras esa pausa este activa, el watchdog, las notificaciones y los envios manuales no deben reconectar ni pedir QR. La pausa se limpia automaticamente solo cuando una conexion valida llega a `open`. En una restriccion real de WhatsApp, esperar a que termine la ventana indicada y no presionar `Borrar sesion y pedir QR` salvo que se vaya a vincular un numero sano.

Los cierres transitorios de infraestructura (`405`, `408`, `428`, `503`, `Connection Failure`, `Connection closed`, `Connection lost` o timeout) no deben crear una pausa de tres horas ni borrar la sesion. El backend conserva las llaves cifradas y deja que el watchdog retome la conexion con espera controlada.

Excepcion segura 2026-07-26: `Stream Errored (restart required)` / codigo `515` puede ocurrir justo despues de escanear QR o despues de cargar llaves validas. No se trata como baneo por si solo. El backend hace un unico reintento corto con `allowQr=false` usando la sesion guardada. Si despues de ese reintento WhatsApp devuelve `401`, `403`, `loggedOut` o pide QR inesperado, la sesion se considera invalida o activa en otro bot y el servicio entra en `PAUSED`.

Regla de estados WhatsApp 2026-07-17: `DISCONNECTED` significa corte recuperable; el watchdog puede volver a intentar con backoff. `QR_REQUIRED` significa que la sesion guardada ya no alcanza y WhatsApp esta pidiendo QR, pero el sistema no lo genera durante autoconnect. `LOGGED_OUT` significa que WhatsApp cerro o invalido la sesion guardada; requiere decision humana antes de pedir QR nuevo.

Regla anti-conflicto 2026-07-17: si `Sesion guardada = Si`, el boton `Iniciar conexion` debe reintentar esa sesion sin generar QR. Si WhatsApp responde `401`, la sesion fue invalidada o el mismo numero esta activo en otro bot/servidor. No se debe mantener el mismo numero corriendo en VEVA y Tecnotitlan al mismo tiempo; hay que apagar uno o usar un puente entre sistemas para evitar cierres de sesion y bloqueos.

Regla de enlace QR 2026-07-17: al escanear QR, Baileys puede cerrar la conexion con `restartRequired` / codigo `515`. Eso no debe tratarse como logout ni como restriccion del numero. El backend guarda `creds.update` inmediatamente, limpia el QR y reconecta en segundos usando la sesion recien guardada, igual que el flujo estable de VEVA. Los cierres de sockets anteriores se ignoran para que no pisen el estado de la conexion vigente.

Regla de relevo EasyPanel 2026-07-28: un deploy puede mantener unos segundos el contenedor anterior mientras inicia el nuevo. El proceso que recibe `SIGTERM` cierra su socket pero conserva por 120 segundos el lease del archivo de bloqueo en el volumen persistente `/app/auth_info_baileys`. El contenedor nuevo no abre simultaneamente la misma sesion: muestra `WAITING_FOR_SESSION_LOCK`, espera a que venza el lease y reintenta automaticamente sin QR. Por eso un deploy puede tardar cerca de dos minutos en devolver WhatsApp a `READY`, pero no debe generar `PAUSED` ni exigir intervencion humana. Esta diferencia de ciclo de vida, y no Render frente a VPS, era la causa de los `405 Connection Failure` durante los redeploys.

### Notificaciones internas de ventas y cambios de estado

Desde 2026-07-14, Tecnotitlan separa las notificaciones del cliente y las notificaciones internas del equipo:

- Cuando un pedido queda pagado, el cliente recibe su confirmacion con estado `Pago confirmado` y el equipo operativo recibe un aviso interno.
- Cuando un pedido cambia de estado (`PENDING_PAYMENT`, `PROCESSING`, `PENDING_FULFILLMENT`, `SHIPPED`, `DELIVERED`, `CANCELLED`), el equipo operativo recibe aviso con pedido, canal, cliente, total y productos.
- Desde 2026-07-23, el cliente tambien recibe notificacion por correo y WhatsApp en cambios generales de estado como `Preparando`, `Por surtir` y `Cancelado`. Los estados `Enviado` y `Entregado` conservan plantillas especiales porque pueden incluir guia, paqueteria y enlace de rastreo.
- Los destinatarios internos son usuarios con rol `SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `VENDEDOR`, `SELLER` o `SALES`, o usuarios con permisos operativos individuales como `order:read`, `order:update`, `inventory:read`, `inventory:update`, `support:update` o `whatsapp:chat`. Esto permite avisar a vendedores con permisos limitados sin abrirles pantallas sensibles.
- Cada usuario puede configurar si recibe avisos por correo, WhatsApp o ambos desde `Usuarios > Editar usuario > Notificaciones operativas`.
- El numero de WhatsApp operativo puede ser especifico para ese usuario; si queda vacio, el sistema intenta usar su telefono registrado.
- La configuracion dinamica de la base de datos tiene prioridad sobre el `.env`. Si `WHATSAPP_AUTO_CONNECT` queda guardado como `false` en `Configuracion > Sistema`, las notificaciones no levantan la sesion aunque el `.env` diga `true`.
- Antes de avisar al equipo por WhatsApp, el backend intenta conectar con la sesion persistente. Si no hay usuarios operativos con WhatsApp habilitado, usa `ADMIN_WHATSAPP_NUMBER` como respaldo cuando este configurado.
- Los pedidos guardan `salesChannel` para distinguir ventas de `WEB`, `MERCADOLIBRE`, `TIKTOK_SHOP` y `AMAZON`. La pantalla de pedidos muestra un chip por canal para no mezclar visualmente ventas web con ventas de marketplace.
- Desde 2026-07-25, los movimientos operativos de inventario (`Entrada`, `Salida manual`, `Traspaso a canal`, `Ajustes` y `Devoluciones`) tambien notifican al equipo por correo/WhatsApp segun sus preferencias.
- Los avisos de movimientos no incluyen costos, margenes ni datos de inversion; solo SKU, producto, cantidad, canal/ubicacion, stock antes/despues y nota operativa.

Regla de seguridad: si WhatsApp no esta conectado, el pedido no se bloquea. El sistema registra el aviso omitido y conserva el flujo por correo/inventario. WhatsApp es un canal de notificacion, no una condicion para vender.

### Respaldo de sesion Baileys en base de datos

Para reducir reinicios de sesion y evitar ciclos de QR, Baileys mantiene el volumen persistente `/app/auth_info_baileys` y ademas guarda la sesion y llaves de mensajes cifradas en la tabla `whatsapp_auth_state`. Al arrancar, si `WHATSAPP_AUTH_STORAGE=database`, el backend restaura el estado desde PostgreSQL antes de inicializar Baileys.

Esta estrategia no evita bloqueos impuestos por WhatsApp si la sesion fue cerrada o invalidada desde el telefono, pero ayuda a sobrevivir redeploys, reinicios del contenedor y perdida accidental de archivos locales.

### Perfil de cliente, celular y domicilios de entrega

Desde 2026-07-17, el registro de clientes exige numero celular/WhatsApp. Este dato es obligatorio porque Tecnotitlan lo usa para seguimiento de pedidos, aclaraciones de entrega, guias y atencion postventa.

El cliente puede editar su informacion desde `Mi cuenta`: nombre, correo, celular y domicilios de entrega. Los domicilios viven en la tabla `customer_addresses` y se relacionan con `users`. Cada domicilio guarda etiqueta, receptor, telefono, calle/direccion, colonia/zona, ciudad, estado, codigo postal, pais y referencias.

Regla operativa: el checkout debe reutilizar domicilios guardados cuando el cliente ya inicio sesion. Si el cliente no tiene domicilios guardados, puede capturar uno nuevo durante el envio. Esto reduce errores de captura y evita pedir la misma informacion en cada compra.

---

## 15. Troubleshooting

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
---

## 16. Mercado Libre: publicacion, inventario e importacion de pedidos

### Fuente unica de inventario

Tecnotitlan es la fuente de verdad del inventario. Las cantidades tienen significados distintos:

- **Bodega/Web:** piezas fisicas disponibles en Tecnotitlan.
- **Asignado a Mercado Libre:** piezas que salieron de Bodega/Web y quedaron reservadas para ese canal.
- **Publicado en Mercado Libre:** cantidad remota enviada por Tecnotitlan. Se calcula como asignado menos stock de seguridad.

El calculo publicable esta protegido contra datos faltantes, negativos o invalidos: nunca envia `NaN` ni una cantidad menor que cero a Mercado Libre. Las pruebas automatizadas cubren stock asignado, buffer mayor al stock y valores invalidos.

Un traspaso de 5 piezas desde Bodega/Web a Mercado Libre deja 0 en bodega si solo habia 5, y deja 5 asignadas a Mercado Libre. No crea otras 5 piezas. Si una publicacion existente tenia 10 unidades remotas, al vincularla Tecnotitlan la concilia a las 5 realmente asignadas.

### Flujo recomendado para un producto nuevo

1. Crear el producto en **Productos** con SKU, precio, descripcion, caracteristicas e imagenes.
2. Registrar la entrada fisica en **Inventario > Entradas**.
3. Realizar el traspaso desde **Bodega/Web** hacia **Mercado Libre**.
4. Abrir el producto, entrar a la seccion **Mercado Libre** y pulsar **Preparar publicacion**.
5. Confirmar categoria, atributos obligatorios, condicion y tipo de publicacion.
6. Pulsar **Publicar en Mercado Libre**.
7. Tecnotitlan crea la publicacion, guarda el item ID, vincula el SKU y publica exclusivamente el stock asignado.

La publicacion se bloquea si no existe stock asignado a Mercado Libre. Para publicaciones creadas previamente fuera de Tecnotitlan, primero se hace el traspaso y despues se usa **Vincular una publicacion existente**.

### Marca y atributos de catalogo

Los valores que Mercado Libre devuelve para atributos como **Marca** son sugerencias del catalogo, no deben obligar a declarar una marca falsa. Cuando la categoria permite una marca textual, Tecnotitlan muestra sugerencias y permite capturar la marca real, por ejemplo `G-TIDE`. El valor se envia como atributo `BRAND` al publicar.

### Recuperacion del producto AUR-002

La publicacion de prueba `MLM3193668611` usa el SKU local `AUR-002`. Si se traspasaron 5 piezas y Bodega/Web quedo en 0, esa distribucion es correcta: las 5 piezas ahora pertenecen al canal Mercado Libre. Al vincular el item, la cantidad remota anterior de 10 debe conciliarse a 5, no sumarse.

### Importacion de pedidos y comisiones

Los pedidos de Mercado Libre se importan de forma idempotente por su ID externo. La comision reportada por Mercado Libre (`marketplace_fee`) se guarda como `paymentFee`; el ingreso neto se calcula como total menos comisiones. Solo despues de crear correctamente el pedido interno se descuenta inventario y se notifican la venta y el estado al equipo.

Las ordenes que antes fallaron con `Argument paymentFee is missing` se pueden recuperar despues de desplegar el backend actualizado pulsando **Leer pedidos**. El reintento no duplica pedidos ya importados.

### Despliegue

No se requiere migracion de Prisma para esta fase. En EasyPanel:

1. Desplegar primero el servicio **api**.
2. Confirmar que el backend inicia y conecta con Prisma.
3. Desplegar despues el servicio **web**.
4. Abrir Mercado Libre en Configuracion y pulsar **Leer pedidos**.

### Proveedor local bajo pedido y precios por canal (2026-07-29)

Esta modalidad permite operar con proveedor local sin mezclar promesas de suministro con mercancia fisica ni con capital invertido.

#### Regla financiera e inventario

- **Inversiones** registra el dinero disponible, entradas de capital y gastos reales. La disponibilidad declarada por un proveedor no reduce una inversion.
- **Bodega/Web** representa solo piezas propias que ya se compraron y recibieron. Las entradas reales se registran desde **Inventario > Entradas**.
- Un producto de tipo **Proveedor local / bajo pedido** conserva, por separado, existencia finita o ilimitada del proveedor y tiempo estimado de surtido.
- Al confirmarse una venta pagada, se usan primero piezas propias. La parte surtida por proveedor genera en ese momento la compra real y su salida por venta; asi el dinero solo se descuenta cuando realmente se necesita comprar ese articulo.
- Una cancelacion aprobada restaura de forma idempotente las piezas propias o del proveedor que se hubieran descontado. No debe duplicar devoluciones ni movimientos.

#### Canales y precios

- Un traspaso sigue siendo fisico: mueve unidades de Bodega/Web a Mercado Libre, TikTok Shop o Amazon. No debe inventar unidades ni cambiar una promesa del proveedor por stock propio.
- **Publicado** es el numero configurado en una publicacion remota; no equivale por si mismo a mercancia apartada. Se conserva separado del stock fisico/asignado.
- El precio web (`product.price`) es el importe meta que se busca recibir antes de costos propios de marketplace. El precio automatico por canal absorbe comision porcentual, cuota fija y envio que el negocio decida absorber:

  `(precio web + cuota fija + envio absorbido) / (1 - comision)`.

- La comision acepta `16` o `0.16` para representar 16%. El precio calculado se puede sobrescribir solo al desactivar **Precio automatico** en el canal.

#### Flujo operativo recomendado

1. Crear producto y definir si es inventario propio o proveedor local bajo pedido.
2. Registrar solamente las compras ya pagadas como entradas de inventario y ligarlas a una inversion cuando corresponda.
3. Configurar precio/comision/cuota por canal antes de publicar.
4. Trasladar unidades fisicas a un marketplace solo cuando efectivamente se manden a su bodega o se reserven para ese canal.
5. Dejar que webhooks importen ventas y actualicen pedidos, movimientos y notificaciones.

La publicacion automatica remota depende todavia de que cada articulo tenga categoria, atributos obligatorios e imagenes aceptadas por Mercado Libre. Esa validacion es necesaria antes de convertir un traspaso en una publicacion real; no es una segunda fuente de inventario.

## Ficha de producto, disponibilidad y resenas (2026-08-09)

- Se conserva una sola ficha publica (`ProductScreen`), una sola ruta por SKU y un solo endpoint de resenas. No se agregaron pantallas ni servicios duplicados.
- `Product.shortDescription` guarda un resumen comercial opcional de hasta 280 caracteres y se muestra debajo del titulo. La descripcion extensa y las especificaciones se mantienen en secciones inferiores para evitar una columna de compra demasiado larga.
- La disponibilidad publica ya no revela tiempos ni condiciones internas del proveedor. Solo muestra `Disponible`, el numero de piezas disponibles o `Agotado temporalmente`.
- Las etiquetas de Tecatl siguen siendo internas: ayudan a buscar y recomendar, pero se filtran de las especificaciones visibles para el cliente.
- El video se reproduce dentro de la galeria del producto. Se admiten enlaces embebibles de YouTube y TikTok, ademas de archivos MP4, WebM u OGG accesibles publicamente.
- Solo un cliente autenticado con una compra pagada y no cancelada que incluya el producto puede publicar una calificacion de 1 a 5 y una opinion de 3 a 1000 caracteres. Solo se permite una resena por usuario y producto; ambas reglas se validan en la aplicacion y la unicidad tambien se protege con un indice unico en PostgreSQL.
- Migraciones nuevas: `20260809120000_add_product_short_description` y `20260809120500_prevent_duplicate_product_reviews`.

## Diagnostico de WhatsApp y Baileys (2026-08-09)

- Baileys es una integracion no oficial y no esta afiliada, autorizada ni respaldada por WhatsApp. No se encontro una regla publica de Meta que afirme que un numero se bloquea automaticamente por enviar un solo mensaje mediante Baileys.
- Una restriccion despues de un solo mensaje puede estar relacionada con confianza o historial del numero, sesiones no oficiales, vinculaciones repetidas por QR, reconexiones, cambios de huella del dispositivo o reportes previos. Esta causa es una inferencia operativa; solo Meta puede confirmar el motivo de una cuenta especifica.
- Los terminos y politicas de WhatsApp permiten limitar o suspender cuentas por uso no autorizado, retroalimentacion negativa, incumplimiento de calidad o mensajes sin consentimiento. La automatizacion debe conservar consentimiento verificable, identificacion clara del negocio y salida sencilla de las notificaciones.
- No se modifico el ciclo de conexion, QR, sesion ni reconexion de WhatsApp durante este cierre. Tampoco se debe desplegar este commit solo para validar la ficha de producto, porque reiniciar el API puede provocar actividad innecesaria de la sesion.
- Ruta recomendada para operacion estable: WhatsApp Cloud API oficial o un proveedor autorizado, numero dedicado de Tecnotitlan, plantillas aprobadas fuera de la ventana de atencion y correo como respaldo. n8n puede orquestar eventos, pero no convierte una sesion Baileys en una integracion oficial.

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

## Actualizacion 2026-08-20 - Publicacion de productos en Mercado Libre

El flujo recomendado queda definido asi:

1. Asignar existencias a Mercado Libre desde Inventario.
2. Abrir el producto, pulsar **Actualizar preparacion** y completar categoria, tipo de publicacion, condicion, marca y modelo.
3. Pulsar **Publicar en Mercado Libre**. No se escribe ningun ID de publicacion para un anuncio nuevo.
4. Tecnotitlan crea el anuncio, guarda inmediatamente el ID remoto devuelto por Mercado Libre y sincroniza el stock publicable.
5. La seccion **Vincular una publicacion existente** es avanzada y solo acepta IDs de anuncios ya creados, por ejemplo `MLM1234567890`. Un ID corto como `MLM126793` corresponde a una categoria y no debe colocarse ahi.

Protecciones implementadas:

- Los errores de publicacion y de vinculacion existente se muestran por separado.
- Si una categoria fue guardada accidentalmente como ID de publicacion, el backend limpia ese vinculo antes de crear el anuncio.
- La interfaz solo oculta **Publicar en Mercado Libre** cuando existe un ID remoto valido (`MLM` seguido de al menos siete digitos); una categoria heredada ya no puede ocultar la accion.
- El ID remoto se guarda antes de intentar actualizar la descripcion, evitando duplicar anuncios si Mercado Libre rechaza solo la descripcion.
- La interfaz muestra el motivo detallado devuelto por Mercado Libre para corregir atributos obligatorios sin adivinar.
- Despues de publicar, el boton **Publicar en Mercado Libre** se reemplaza por una tarjeta **Publicado en Mercado Libre**. Esta tarjeta muestra el item ID, el enlace directo, una accion para copiarlo, el stock publicable, el estado remoto y la ultima sincronizacion.
- La accion de publicar no vuelve a mostrarse mientras exista un item ID remoto valido, para evitar anuncios duplicados. La tarjeta conserva la accion **Sincronizar stock**.
- Una publicacion creada con un vendedor de prueba solo aparece en la cuenta `TESTUSER` que autorizo Tecnotitlan. No aparece en la cuenta real de Mercado Libre hasta reconectar esa cuenta y publicar desde ella.
# Mercado Libre: vinculacion estricta por SKU local (2026-08-23)

- Cada producto de Tecnotitlan mantiene una publicacion independiente en Mercado Libre con el mismo SKU local.
- Una publicacion remota solo puede reutilizarse cuando su `seller_custom_field` o atributo `SELLER_SKU` coincide exactamente con el SKU local.
- Si un producto guarda por error el ID de otra publicacion o el ID de una categoria, Tecnotitlan limpia solamente ese vinculo local y crea una publicacion nueva para el SKU correcto.
- La autocorreccion nunca elimina ni modifica la publicacion remota ajena. Por ejemplo, `AUR-002` permanece separado de cualquier reloj `WTC-*`.

## Actualizacion 2026-08-23 - Familia obligatoria de Mercado Libre

- La creacion de publicaciones envia `family_name` en la raiz del payload, como exige Mercado Libre.
- El valor se construye con marca y modelo, por ejemplo `G-Tide R9 Pro`, sin duplicar la marca.
- Si el formulario envia una familia explicita, ese valor tiene prioridad. Como respaldo se usa modelo, marca, nombre del producto o SKU.
- Cuando se usa `family_name`, Tecnotitlan no envia `title` en la misma solicitud porque Mercado Libre rechaza esa combinacion con `body.invalid_fields`.
- Los errores de Mercado Libre ahora decodifican entidades HTML y muestran causas, referencias y atributos invalidos cuando la API los proporciona.

## Actualizacion 2026-08-27 - Codigo universal GTIN/EAN/UPC

- Los productos pueden guardar un codigo universal `gtin` opcional de 8, 12, 13 o 14 digitos.
- El formulario administrativo permite capturarlo una sola vez y lo reutiliza al preparar y publicar en Mercado Libre.
- Si la categoria de Mercado Libre exige `GTIN`, Tecnotitlan lo envia como atributo de la publicacion y bloquea el envio con un mensaje claro cuando falta.
- La migracion `20260823000000_add_product_gtin` agrega la columna sin modificar productos existentes.

## Actualizacion 2026-08-27 - Categorias de Mercado Libre importadas en vivo

- `Preparar publicacion` consulta el predictor oficial de Mercado Libre con el nombre del producto y muestra las tres mejores categorias sugeridas.
- Cada opcion muestra la ruta completa del arbol y su ID `MLM`; el operador selecciona una categoria sin memorizar ni escribir identificadores.
- Al cambiar de categoria, Tecnotitlan vuelve a importar sus atributos obligatorios y recomendados.
- Los atributos con `conditional_required`, como GTIN en Smartwatches, se muestran antes de publicar. Cuando Mercado Libre ofrece `EMPTY_GTIN_REASON`, el operador captura el codigo real o selecciona un motivo valido; nunca se inventa un GTIN ni se exigen ambas alternativas.
- Las categorias no se duplican en la base de datos local: se consultan en vivo para evitar trabajar con un arbol obsoleto de Mercado Libre.
- Antes de crear un anuncio, Tecnotitlan consulta las publicaciones de la cuenta por `seller_custom_field`/`SELLER_SKU`. Si el SKU ya existe, bloquea el alta duplicada y permite vincular el item encontrado.
- Tecnotitlan tambien consulta `/products/search`: primero por GTIN y, cuando no existe, por marca y nombre dentro del dominio sugerido. Una ficha de catalogo no es una categoria ni una publicacion; solo se asocia cuando el operador confirma que modelo y variante coinciden exactamente.
- La mejor ficha queda seleccionada automaticamente: un GTIN unico obtiene coincidencia exacta; sin GTIN se ordenan las sugerencias por marca, modelo, nombre y atributos. El operador conserva un selector para cambiar la ficha o publicar sin asociarla cuando ninguna variante sea correcta.
- El payload se comprueba con `/items/validate` antes de ejecutar `POST /items`. Los atributos enumerados conservan tanto `value_id` como `value_name`, incluido `EMPTY_GTIN_REASON`.
- La publicacion consulta `/users/{seller_id}/shipping_preferences` y elige un modo habilitado, priorizando ME2. Las causas de validacion marcadas por Mercado Libre como `warning` no bloquean el alta; si exige envio gratis, se revalida con `shipping.free_shipping=true`. Las causas de tipo `error` si detienen la publicacion.

## Actualizacion 2026-08-28 - Cotizacion e imagenes de Mercado Libre

- Antes de publicar, Tecnotitlan consulta en vivo la comision y el costo de envio para la categoria, modalidad Clasica o Premium, precio, dimensiones y configuracion logistica de la cuenta.
- La pantalla muestra precio base, precio sugerido, comision, envio, otros cargos y neto estimado. El operador debe confirmar expresamente el desglose; el backend vuelve a calcularlo y aplica el precio sugerido, por lo que no confia en importes enviados por el navegador.
- En una publicacion vinculada, la sincronizacion manual confirmada aplica juntos el precio sugerido y el stock publicable. Las sincronizaciones automaticas de inventario conservan el precio remoto.
- Clasica se identifica como la opcion de menor comision y sin meses sin intereses; Premium ofrece mayor exposicion y meses sin intereses con una comision superior. La interfaz incluye ayuda contextual junto al selector.
- Las imagenes se cargan primero al servicio de imagenes de Mercado Libre. Solo se anexan las que Mercado Libre procesa con al menos 500 x 500 pixeles; los archivos pequenos o rechazados se omiten y se reportan como advertencia. Si ninguna imagen es valida, la publicacion se bloquea.
- Cuando se selecciona una ficha exacta de catalogo, sus imagenes oficiales se agregan a las imagenes propias sin duplicar IDs, hasta el limite de Mercado Libre.
- La cotizacion detecta cuando la cuenta conectada no reporta RFC y agrega la estimacion conservadora de retenciones maximas sobre la base sin IVA. Con RFC detectado muestra una advertencia porque el importe exacto depende del regimen validado por Mercado Libre.
- En publicaciones vinculadas, el costo de envio se consulta por `item_id` para utilizar las dimensiones logisticas efectivas de Mercado Libre. Al importar una venta de una sola pieza, las dimensiones del paquete remoto actualizan la ficha local para futuras simulaciones.

## Actualizacion 2026-08-28 - Guias de Mercado Envios en Pedidos

- Al recibir o releer una orden, Tecnotitlan consulta `/shipments/{shipping_id}` y guarda automaticamente destinatario, domicilio, telefono disponible, paqueteria, numero de guia, estado, modalidad logistica, costo, dimensiones y fecha estimada.
- Los webhooks de envios refrescan el pedido local sin esperar una captura manual.
- La tarjeta administrativa del pedido permite actualizar el envio y descargar/imprimir la etiqueta oficial PDF desde `/shipment_labels` cuando el envio ME2 esta `ready_to_ship` y `ready_to_print` o `printed`.
- Las etiquetas no se inventan ni se almacenan como documentos propios: se solicitan autenticadas a Mercado Libre y se entregan al operador para impresion.

## Actualizacion 2026-08-28 - Reclamos, devoluciones y comunicaciones Mercado Libre

- El Centro de Reclamos conserva expediente, pedido relacionado, plazo oficial, impacto en reputacion, devolucion, rastreo, costo, estado del dinero, inspeccion y bitacora de acciones.
- Los webhooks `post_purchase`, `claims` y `claims_actions` actualizan el expediente; las acciones monetarias o de resolucion solo se habilitan cuando Mercado Libre las reporta disponibles y exigen confirmacion del folio.
- La bandeja **Mensajes ML** unifica preguntas preventa y conversaciones posventa sin mezclar sus reglas.
- Las preguntas se sincronizan desde `/questions/search`, se vinculan por `meliItemId` al producto local y se responden mediante `/answers`. Los webhooks `questions` mantienen el estado actualizado.
- Los mensajes posventa se consultan por paquete con `mark_as_read=false`, se relacionan con el pedido importado y solo se marcan como leidos cuando el operador lo solicita.
- Tecnotitlan solo permite responder una conversacion posventa activa iniciada por el comprador. No envia mensajes automaticos repetitivos ni inicia contactos fuera del flujo autorizado por Mercado Libre.
- Los webhooks `messages` recuperan el mensaje notificado y resincronizan la conversacion completa. Como respaldo, la bandeja consulta preguntas y pendientes al abrirse. La interfaz muestra contador, alerta sonora disponible, responsable, estado interno y trazabilidad.
- El texto posventa respeta el limite dinamico informado por Mercado Libre, normalmente 350 caracteres. La implementacion reconoce la ruta de agentes de mensajeria y conserva compatibilidad con conversaciones anteriores.
- Las tablas `meli_questions`, `meli_post_sale_conversations`, `meli_post_sale_messages` y `meli_communication_activities` separan los datos operativos, mensajes y auditoria.

## Actualizacion 2026-08-30 - Bandeja unificada ligada al pedido

- La ruta administrativa **Atencion > Bandeja unificada** reúne WhatsApp, tickets de soporte y correo, preguntas y mensajes posventa de Mercado Libre, reclamos y conversaciones escaladas de Tecatl.
- Cada expediente muestra en la misma vista el historial del canal, estado, prioridad, cliente y el contexto comercial del pedido: numero, estado, canal de venta, total y productos con SKU.
- Los pedidos nativos de Mercado Libre quedan confirmados por su relacion de origen. En otros canales sólo se sugieren coincidencias exactas por usuario, correo completo o los 10 digitos del telefono; la sugerencia no se persiste ni se considera confirmada hasta que un operador la acepta.
- El operador puede buscar por numero de pedido, cliente, telefono, SKU o folio externo, confirmar o cambiar el vínculo y quitar un vínculo manual. Un vínculo manual siempre tiene prioridad sobre cualquier sugerencia automatica.
- Las respuestas se envian mediante el canal original y respetan sus reglas: WhatsApp, correo de soporte, respuestas preventa, mensajes posventa, reclamos o escalamiento Tecatl. El backend vuelve a validar permisos por origen y el estado que permita responder.
- Las tablas `unified_inbox_links` y `unified_inbox_replies` conservan los vínculos confirmados y la trazabilidad de respuestas. Ninguna coincidencia parcial o difusa vincula automaticamente datos de clientes distintos.
- El menu muestra un contador agregado de conversaciones pendientes y la bandeja se actualiza cada 30 segundos sin interrumpir el trabajo del operador.

## Actualizacion 2026-08-30 - Inspeccion y cuarentena de devoluciones

- La ruta **Atencion > Devoluciones y cuarentena** controla la recepcion fisica de devoluciones asociadas a un pedido y, cuando corresponde, a un reclamo de Mercado Libre.
- Al recibir un paquete se registra ubicacion de cuarentena, condicion del empaque, sello, evidencia, notas y cantidades reales por producto. La recepcion no modifica `Product.countInStock` ni el stock de ningun marketplace.
- Cada pieza conserva pedido, SKU, cantidad esperada y recibida, numeros de serie, evidencia fotografica, hallazgos y una lista obligatoria de verificacion: serie, accesorios, funcionamiento, estetica y empaque.
- Los dictamenes disponibles son: mantener en cuarentena, reintegrar a bodega, reacondicionar, devolver a proveedor o dar de baja. No puede aplicarse un destino final mientras falten piezas por inspeccionar, condicion fisica, checklist o evidencia/notas suficientes.
- Unicamente **Reintegrar a bodega** crea un movimiento `RETURN_IN` con `referenceType=RETURN_INSPECTION` y aumenta el stock Web/bodega. Dañados, incompletos, reacondicionamiento, proveedor y baja nunca se vuelven vendibles automaticamente.
- La finalizacion es idempotente por pieza: repetir la solicitud no duplica inventario. El expediente guarda quién recibio, quién finalizo, fechas y ubicacion; el reclamo Mercado Libre recibe el resultado de inspeccion y una actividad de auditoria.
- Las recepciones parciales estan permitidas, pero la suma de todos los expedientes nunca puede superar la cantidad vendida en el pedido.

## Actualizacion 2026-08-30 - SLA, alertas, plantillas y calidad

- Cada expediente de la bandeja unificada calcula un objetivo de primera respuesta según canal y prioridad. WhatsApp y Tecatl tienen ventanas cortas; soporte, preguntas, posventa y reclamos usan ventanas propias, ajustadas para prioridades alta y urgente.
- El reloj sólo corre cuando existe un mensaje pendiente real (`unreadCount > 0`) y no hay una respuesta posterior. Los estados son `ON_TRACK`, `AT_RISK`, `BREACHED` y `MET`; las conversaciones ya leidas no generan falsos vencimientos.
- Un monitor interno revisa la bandeja cada cinco minutos y registra alertas por vencer o vencidas en `NotificationLog`. La deduplicacion de doce horas evita inundar al equipo por el mismo expediente.
- La pantalla **Atencion > SLA y calidad** muestra cumplimiento, primera respuesta promedio, vencimientos, riesgo y rendimiento por canal. La bandeja muestra el objetivo, tiempo restante y fecha limite junto a cada conversación.
- Las plantillas se administran por canal y categoria. Admiten `customer_name`, `order_number`, `agent_name` y `agent_note`; siempre se insertan como borrador para que un agente revise el texto antes de enviarlo.
- La calidad se evalua del 1 al 5 en claridad, empatia, exactitud, resolucion y cumplimiento. Cada revision guarda promedio, notas, revisor, canal, expediente y fecha para conservar trazabilidad.
- Las tablas `inbox_response_templates` e `inbox_quality_reviews` separan contenido operativo y evaluaciones. La migracion incluye plantillas iniciales de seguimiento, reclamo, evidencia y cierre.
- El dashboard ejecutivo incorpora analitica propia de vistas: total, vistas del dia, visitantes aproximados, paginas por visitante, paginas de entrada, fuente, referente, dispositivo y pais cuando el proxy entrega ese dato.
- La medicion excluye rutas administrativas y robots, respeta `Do Not Track`, elimina parametros sensibles al guardar sólo `pathname` y deduplica recargas del mismo visitante/pagina durante 30 segundos.
- La IP nunca se almacena. Para estimar visitantes se genera un hash SHA-256 diario con secreto del servidor, IP y agente de usuario; el identificador cambia cada dia y no permite recuperar la IP original.

## Actualizacion 2026-08-30 - Cifrado de tokens, auditoria y 2FA

- Los tokens de acceso y renovacion de Mercado Libre y TikTok Shop se guardan con AES-256-GCM. Cada valor usa un nonce aleatorio y etiqueta de autenticidad; el prefijo versionado `enc:v1` permite rotaciones futuras sin confundir texto antiguo con ciphertext.
- Al arrancar, la API migra de forma compatible cualquier token heredado en texto claro y elimina tokens, secretos y contrasenas duplicados dentro de `rawData`. Las conexiones existentes se conservan; la aplicacion descifra únicamente en memoria cuando llama al proveedor.
- La clave se deriva de `TOKEN_ENCRYPTION_KEY`; como compatibilidad operativa usa `SESSION_SECRET` o `JWT_SECRET`. Cambiar la clave sin un proceso de rotacion vuelve ilegibles los tokens almacenados.
- Cada usuario puede activar TOTP desde **Seguridad y 2FA** mediante QR o clave manual. La activacion exige la contrasena actual y un codigo valido; se entregan diez codigos de recuperacion de un solo uso, almacenados únicamente como hashes.
- El login con 2FA usa un reto JWT de cinco minutos y no entrega una sesion completa hasta validar TOTP o un codigo de recuperacion. Activar/desactivar 2FA o cambiar la contrasena incrementa `tokenVersion` e invalida sesiones anteriores.
- `audit_logs` registra mutaciones autenticadas, accesos y cambios de seguridad con actor, accion, categoria, resultado, ruta y fecha. No copia cuerpos de solicitudes, contrasenas ni tokens; la IP se convierte en una huella HMAC irreversible.
- Cada usuario consulta su actividad reciente. El Super Admin dispone de **Administracion > Seguridad y auditoria** con los últimos eventos operativos y administrativos.
