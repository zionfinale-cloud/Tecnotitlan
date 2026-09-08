# Documentación Maestra del Proyecto: Tecnotitlan

> **Estado del documento (8 de septiembre de 2026):** Fuente de verdad técnica vigente.
> Describe el estado confirmado del repositorio en el commit `cced8b81`. Los datos de
> infraestructura y secretos nunca deben copiarse aquí; se administran fuera de Git.

Este documento es la guía técnica central y única fuente de verdad para el proyecto de e-commerce **Tecnotitlan**. Cubre la visión, arquitectura, guías de instalación, despliegue y hoja de ruta.

## 1. Visión General y Objetivos

- **Core Business:** Plataforma de e-commerce **"marca blanca"** y personalizable, diseñada para ser replicada en diferentes nichos de mercado (ej. tecnología, ropa, etc.). El sistema permite una personalización completa del frontend (nombre, logo, colores, slogan) a través del panel de administración.
- **Omnicanal:** La web propia y Mercado Libre son los canales operativos actuales. TikTok Shop y Amazon están previstos como fases posteriores; las redes sociales funcionan como adquisición y atención, no como inventarios independientes.
- **Comunicación Automatizada:**

    - **Bot de WhatsApp:** Ruta operativa unica con **Baileys v7** y sesion cifrada en Supabase/PostgreSQL. La sesion se conserva entre redeploys usando `WHATSAPP_AUTH_STORAGE=database` y un `SESSION_SECRET` estable.
    - **Chatbot Web:** Sincronizado con el sistema para ofrecer soporte en tiempo real.
    - **WhatsApp vigente 2026-09:** Baileys `7.0.0-rc13` queda fijado, con un solo gateway, sesión cifrada, reconexión controlada y avisos internos a un grupo único.
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

## 2. Estado vigente y pila tecnológica

**Última actualización:** 8 de septiembre de 2026.

- **Repositorio:** rama `main`; último cierre documentado `cced8b81`.
- **Producción:** frontend y API se despliegan como contenedores separados en el VPS mediante `compose.vps.yml`. Toda migración Prisma se ejecuta antes de levantar la API actualizada.
- **Base de datos:** PostgreSQL/Supabase; pooler para tráfico y `DIRECT_URL` para migraciones.
- **Backend:** Node.js 22, Express, Prisma 5 y Socket.IO.
- **Frontend:** React 18, Vite 8, CSS Modules y Nginx.
- **Pruebas:** `node:test` y Cypress. El cierre de 2026-09-08 aprobó 111 pruebas de backend y el build Vite.
- **Pagos:** Stripe está integrado. Transferencia/SPEI, Mercado Libre y WhatsApp son flujos manuales controlados. PayPal se conserva para una fase posterior y no debe presentarse como activo.
- **WhatsApp:** Baileys `7.0.0-rc13` fijado, sesión cifrada en PostgreSQL y un solo grupo administrativo. Cloud API no es la ruta operativa actual.
- **Monitoreo:** Sentry está integrado sin PII y se activa únicamente al configurar los DSN.

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
    - Enviar la cookie de sesión HttpOnly sin exponer el JWT a JavaScript.
    - Estandarizar el manejo de respuestas y errores.
    - Gestionar la expiración de sesión de forma global.
- **Autorización RBAC Flexible:** El acceso a rutas protegidas (ej. el panel de admin) se controla mediante permisos (`access:admin_panel`) en lugar de roles fijos. El rol base define permisos heredados, pero cada usuario puede tener excepciones individuales: permisos permitidos extra (`UserPermissionGrant`) y permisos bloqueados (`UserPermissionDeny`). Esto permite que un vendedor especifico pueda tener mas acceso que otro sin crear roles duplicados, y permite ocultar costos, inversiones o configuraciones sensibles a quien no deba verlas.
- **Estilos con CSS Modules:** Se adoptó un enfoque de estilos encapsulados por componente para evitar conflictos de clases y mejorar la mantenibilidad. Las variables CSS globales (`:root` en `index.css`) permiten una personalización centralizada del tema.
- **Estado reutilizable:** Contextos de autenticación, configuración, carrito, notificaciones, carga y tiempo real centralizan el estado compartido. `useProductFilters` encapsula los filtros del catálogo.
- **Lógica de Precios Segura:** El cálculo de precios y totales se realiza exclusivamente en el backend (`orderController.js`) para prevenir manipulaciones desde el cliente.
- **Transacciones Atómicas en la Base de Datos:** Se utilizan las **transacciones interactivas de Prisma** (`$transaction`) para garantizar que operaciones complejas (como crear un pedido y descontar stock) se completen con éxito o fallen juntas, manteniendo la consistencia de los datos.
- **Componentes modulares:** Layouts, rutas protegidas, búsqueda, calificación, carga, navegación y paneles se mantienen separados de las reglas de negocio y reutilizan contextos compartidos.
- **Estrategia de Conexión a Base de Datos (Supabase):** Se utiliza una configuración dual para optimizar la conexión con Supabase en entornos Serverless/Docker:
    - **Transaction Pooler (Puerto 6543):** Utilizado por la aplicación en producción (`DATABASE_URL`) para gestionar eficientemente las conexiones y evitar el agotamiento de límites. Requiere el parámetro `?pgbouncer=true`.
    - **Conexión Directa (Puerto 5432):** Utilizada exclusivamente para migraciones de esquema (`DIRECT_URL`), ya que Prisma necesita control total sobre la conexión para cambios estructurales.
- **Estrategia de Subida de Archivos Flexible:** El sistema de subida de imágenes (`uploadController.js`) es dinámico y configurable mediante una variable de entorno (`UPLOAD_STRATEGY`), permitiendo cambiar entre almacenamiento local y Cloudinary sin modificar el código.
- **Estandarización de Respuestas API:** Todas las respuestas del backend siguen un formato consistente (`{ status: 'success', data: {...} }` o `{ status: 'error', message: '...' }`), lo que simplifica la lógica del frontend.
- **Seguridad del Backend:** Se implementan medidas de seguridad estándar como `helmet` para cabeceras HTTP, `cors` para control de origen y `express-rate-limit` para prevenir ataques de fuerza bruta en endpoints de autenticación.
- **Sistema de Configuración Dinámica:** La aplicación carga su configuración (claves de API, nombres, etc.) desde la base de datos al arrancar (`configService.js`). Esto permite a los administradores modificar el comportamiento y las integraciones (Stripe, Mercado Libre y WhatsApp) a través del panel de administración (`/admin/settings/*`) sin necesidad de redesplegar el código.
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
    - ✅ **Pasarelas de Pago:** Stripe activo; PayPal queda diferido y no forma parte del checkout vigente.
    - ✅ **Notificaciones:** Gateway Baileys central para atención, adjuntos y notificaciones transaccionales.
    - 🔄 **Marketplaces:** Mercado Libre operativo; TikTok Shop y Amazon permanecen como fases posteriores.

- **Configuración del Sistema**
    - ✅ **Modelos:** `Setting` para almacenar configuraciones dinámicas.
    - ✅ **Endpoints:** API para leer y actualizar configuraciones desde el panel de admin.
    - ✅ **Caché de Configuración:** `configService.js` para optimizar el acceso a las configuraciones.

### 4.2. Frontend (Funcional y Refactorizado)

- **UI/UX (Experiencia de Usuario):**
    - **Navegación de Catálogo:** `HomeScreen.js` presenta el catálogo y `SearchBox.js` ofrece búsqueda con debounce. Disponibilidad y agotados se validan también en backend.
    - **Detalle de Producto:** Página rediseñada con galería de imágenes interactiva (zoom/lightbox) y layout profesional.
    - **Feedback Visual:** Notificaciones "toast", animaciones en el carrito y estados de carga claros en toda la aplicación.    
    - **Componentes:** Los elementos compartidos de catálogo, calificación, navegación, alertas y carga usan CSS Modules y estilos globales controlados.
- **Lógica de Cliente:**
    - **Autenticación:** `AuthContext` gestiona el estado del usuario en toda la app.
    - **Carrito de Compras:** `CartContext` maneja la lógica del carrito de forma robusta.
    - **Manejo de Sesión Global:** El interceptor de `apiService.js` detecta automáticamente los errores `401` (sesión expirada). Al ocurrir uno, limpia el estado y redirige al login. El JWT se entrega mediante cookie HttpOnly y no se conserva en `localStorage`.
    - **Checkout:** Flujo completo desde dirección y envío hasta Stripe o un método manual controlado; PayPal queda diferido.
- **Perfil de Usuario:** Los usuarios pueden actualizar sus datos, domicilios, contraseña y 2FA, además de consultar pedidos y seguimiento.
- **Panel de Administración:**
    - **Layout:** `AdminLayout.js` y `SubMenu.js` controlan la navegación y la estructura del panel.
    - **CRUD de Productos:** Formularios para crear y editar productos, con subida de imágenes, gestión de stock, características dinámicas y vinculación con Mercado Libre.
    - **Gestión de Pedidos:** Listado de todos los pedidos con filtros y capacidad para actualizar su estado.
    - **Gestión de Categorías:** Interfaz para administrar categorías y subcategorías.
    - **Gestión de Usuarios:** Interfaz para listar, editar (nombre, email, rol) y eliminar usuarios.
    - **Gestión de Roles y Permisos:** Interfaz para crear, editar y eliminar roles, asignando permisos específicos.
    - **Reportes:** Pantallas dedicadas para visualizar reportes de ventas, ganancias y productos más vendidos.
    - **Configuración:** Existen pantallas para tienda, sistema, Mercado Libre, WhatsApp, seguridad, usuarios, roles y preferencias operativas.

---

## 5. Estructura actual del proyecto

```text
Tecnotitlan/
├── backend/                 # API Express, Prisma, servicios y pruebas node:test
│   ├── prisma/              # Esquema y migraciones versionadas
│   └── src/                 # Controllers, routes, middleware, services y módulos
├── frontend/                # React 18 + Vite; salida en build/
├── docs/                    # Auditorías y decisiones técnicas
├── ops/                     # Operación, respaldo y endurecimiento del VPS
├── .github/workflows/       # Monitor de salud de producción
├── compose.vps.yml          # API, web y n8n
└── .env.vps.example         # Inventario de variables sin secretos
```

## 6. Configuración y secretos

- Usar `.env.vps.example` como inventario; nunca guardar credenciales reales en Git.
- `DATABASE_URL` usa el pooler y `DIRECT_URL` se reserva para migraciones.
- `JWT_SECRET`, `SESSION_SECRET` y `TOKEN_ENCRYPTION_KEY` deben ser largos, estables y distintos. Rotarlos exige migración.
- WhatsApp vigente: `WHATSAPP_PROVIDER=baileys`, `WHATSAPP_AUTH_STORAGE=database` y `WHATSAPP_ADMIN_GROUP_JID`.
- `SENTRY_DSN` y `REACT_APP_SENTRY_DSN` activan monitoreo. Ningún secreto del backend se expone en `env.js`.
- La tabla `settings` puede ganar sobre el entorno después de `initializeConfig()`; revisar valores antiguos ante discrepancias.

## 7. Desarrollo y verificación

```bash
npm --prefix backend ci
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend ci
npm --prefix frontend run build
```

Antes de integrar también se ejecutan `npm audit`, `prisma validate` y `git diff --check`. Las pruebas de WhatsApp usan sockets simulados: no escanean QR, no vinculan cuentas y no envían mensajes reales.

## 8. Despliegue vigente en VPS

1. Crear respaldo cifrado y comprobar espacio, PostgreSQL y contenedores.
2. Actualizar código y construir imágenes con Node.js 22.
3. Ejecutar `prisma migrate deploy` antes de levantar la API nueva.
4. Levantar primero API y verificar `/health/ready`; después web y `/health`.
5. Validar login/2FA, catálogo, pedidos, Mercado Libre, Bandeja unificada y un usuario real por rol.
6. No borrar sesión Baileys ni pedir QR durante un despliegue. El lock impide dos sockets simultáneos.
7. Ante fallo, conservar base de datos y volúmenes y volver a la imagen anterior.

Detalles adicionales: `README.md`, `DEPLOY_VPS_EASYPANEL.md` y `ops/`.

## 9. Integración continua y salud

`.github/workflows/production-health.yml` corre cada quince minutos y manualmente. Verifica tienda, HSTS/CSP, healthcheck web y conectividad API/base de datos. No sustituye las pruebas locales ni Sentry.

## 10. Hoja de ruta vigente

1. Activar Sentry con ambos DSN y validar un evento controlado sin PII.
2. Completar los controles productivos que marque Seguridad, especialmente cifrado independiente, archivos y canales transaccionales.
3. Probar cada rol real: RBAC, privacidad financiera, “Mi trabajo” y Bandeja unificada.
4. Mantener Baileys en `7.0.0-rc13` hasta una liberación posterior estable; no instalar `master`.
5. Reforzar E2E de checkout, devoluciones, reclamos, guías y webhooks repetidos.
6. Integrar PayPal al final, después de Stripe y conciliación.
7. TikTok Shop y Amazon permanecen posteriores a Mercado Libre.

## 11. Flujo de negocio e infraestructura

1. El navegador consume exclusivamente la API; nunca escribe pedidos directamente en Supabase.
2. La API valida sesión, RBAC, precios, inventario y pago antes de transacciones Prisma.
3. Stripe y Mercado Libre usan webhooks verificados e idempotentes.
4. Inventario y pedidos son fuente interna de verdad; marketplaces guardan IDs, stock, comisiones y auditoría.
5. Socket.IO invalida recursos y el frontend los consulta por AJAX; el sondeo de cinco minutos es respaldo.
6. n8n es auxiliar y no reemplaza reglas críticas, transacciones, RBAC ni webhooks del backend.
7. Correo y WhatsApp notifican después de mutaciones; un fallo del canal no revierte una venta.

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

## 13. WhatsApp/Baileys: arquitectura vigente

La ruta operativa es **Baileys `7.0.0-rc13` fijado exactamente**. Cloud API permanece inactivo y diferido; conservar su código no autoriza su uso.

### Sesión y conexión

- `WHATSAPP_PROVIDER=baileys`, `WHATSAPP_AUTH_STORAGE=database` y `SESSION_SECRET` estable.
- Credenciales, TC tokens y mapeos PN/LID se persisten cifrados con AES-256-GCM.
- Inicialización única, lock con heartbeat y guardas de identidad evitan dos sockets activos.
- QR sólo por acción explícita de Super Admin. Watchdog, reconexiones y notificaciones nunca crean QR ni borran sesión.
- No se usa `requestPairingCode`; `resetSession` es destructivo y sólo procede ante un cambio deliberado.

### Identidad y envío

- `@lid` es válido e inmutable; nunca se convierte en teléfono inventado.
- Para PN se consulta primero PN→LID; sin mapeo se usa `onWhatsApp()`.
- `exists:false` o fallo de lookup produce cero envíos.
- Texto, multimedia, Técatl y alertas pasan por un gateway: un `sendMessage`, sin fallback ni retry oculto.
- Alertas internas Baileys se envían una vez a `WHATSAPP_ADMIN_GROUP_JID`, sin fan-out privado.

### Versión y circuito protector

- La versión WA Web verificada se congela por proceso y se guarda como último valor bueno. `isLatest=false` se rechaza; sin caché se usa el default incluido.
- 463 síncrono o en `messages.update` abre `PAUSED`: bloquea envíos, no reintenta, no hace logout ni pide QR. El socket se conserva sólo para recepción si sigue abierto.
- 428 es protegido. 408 admite como máximo el reintento configurado y después pausa. 515 admite un único reinicio corto.
- 405 espera el lock de relevo; 401/403/411/500, logout, sesión inválida o rate limit exigen revisión manual.
- Se registra `operationId`, ID del proveedor, identidad solicitada/resuelta, tipo PN/LID, código, conexión y timestamps.

### Operación segura

- No probar con números restringidos ni repetir QR para “rescatarlos”.
- Un fallo de WhatsApp no bloquea pedidos, correo, inventario ni auditoría.
- Baileys usa logger silencioso. No enviar credenciales, tokens, mensajes completos ni teléfonos a Sentry.
- Matriz upstream: `docs/ESTABILIZACION_WHATSAPP_TECATL_2026-09-08.md`.

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

### Técatl en WhatsApp y escalación humana

- Los chats directos se guardan en Bandeja unificada y conservan el JID. Grupos, estados, broadcasts, newsletters y `fromMe` se ignoran.
- Técatl usa catálogo, pedidos y conocimiento. Si no puede responder con certeza, crea o reutiliza un `ConversationHandoff` y marca `HUMAN_REQUIRED`.
- Una escalación genera correo para destinatarios habilitados y **un solo mensaje** al grupo Baileys, nunca mensajes privados paralelos.
- Horario humano: 09:00–19:00, `America/Mexico_City`. Fuera de horario se acusa recepción y queda pendiente.
- Entregas, omisiones, deduplicación y fallos se guardan en `NotificationLog`.
- El operador responde desde Bandeja unificada o la herramienta especializada, siempre con RBAC.

### Notificaciones transaccionales

- Clientes: pago, preparación, envío, entrega o cancelación según pedido y canal.
- Equipo: pagos, incidencias y movimientos; por Baileys llegan al grupo único.
- No incluyen costos, márgenes ni inversiones. Backend también filtra esos datos sin `finance:read_costs`.
- Un fallo de notificación no revierte la mutación comercial.

### Respaldo de sesión

PostgreSQL cifrado es la fuente principal. El volumen `/app/auth_info_baileys` sirve para compatibilidad por archivos y lock de relevo. La persistencia ayuda ante reinicios, pero no elimina restricciones de WhatsApp.

### Perfil de cliente, celular y domicilios de entrega

Desde 2026-07-17, el registro de clientes exige numero celular/WhatsApp. Este dato es obligatorio porque Tecnotitlan lo usa para seguimiento de pedidos, aclaraciones de entrega, guias y atencion postventa.

El cliente puede editar su informacion desde `Mi cuenta`: nombre, correo, celular y domicilios de entrega. Los domicilios viven en la tabla `customer_addresses` y se relacionan con `users`. Cada domicilio guarda etiqueta, receptor, telefono, calle/direccion, colonia/zona, ciudad, estado, codigo postal, pais y referencias.

Regla operativa: el checkout debe reutilizar domicilios guardados cuando el cliente ya inicio sesion. Si el cliente no tiene domicilios guardados, puede capturar uno nuevo durante el envio. Esto reduce errores de captura y evita pedir la misma informacion en cada compra.

---

## 15. Troubleshooting

### No puedo iniciar sesión como administrador (Error 401)

1. Verificar `/health/ready`, PostgreSQL y que las migraciones estén aplicadas.
2. Confirmar orígenes permitidos y que la cookie HttpOnly llegue con los atributos esperados.
3. Revisar que reCAPTCHA tenga claves del dominio. Nunca desactivar el middleware en producción como diagnóstico.
4. Si la contraseña ya fue aceptada, completar el reto 2FA. Una sesión de enrolamiento sólo abre Seguridad, perfil y cierre de sesión.
5. Usar `seed:import` únicamente en una base nueva y verificada; nunca sobre producción existente sin respaldo.

### La pantalla de Seguridad queda cargando

Comprobar `/api/security/status`, `/api/security/readiness`, la cookie y la consola del navegador. El 2FA queda activo sólo después de confirmar un TOTP válido; generar el QR no termina el enrolamiento.
---

## 16. Ficha de producto, disponibilidad y reseñas

- Se conserva una sola ficha publica (`ProductScreen`), una sola ruta por SKU y un solo endpoint de resenas. No se agregaron pantallas ni servicios duplicados.
- `Product.shortDescription` guarda un resumen comercial opcional de hasta 280 caracteres y se muestra debajo del titulo. La descripcion extensa y las especificaciones se mantienen en secciones inferiores para evitar una columna de compra demasiado larga.
- La disponibilidad publica ya no revela tiempos ni condiciones internas del proveedor. Solo muestra `Disponible`, el numero de piezas disponibles o `Agotado temporalmente`.
- Las etiquetas de Tecatl siguen siendo internas: ayudan a buscar y recomendar, pero se filtran de las especificaciones visibles para el cliente.
- El video se reproduce dentro de la galeria del producto. Se admiten enlaces embebibles de YouTube y TikTok, ademas de archivos MP4, WebM u OGG accesibles publicamente.
- Solo un cliente autenticado con una compra pagada y no cancelada que incluya el producto puede publicar una calificacion de 1 a 5 y una opinion de 3 a 1000 caracteres. Solo se permite una resena por usuario y producto; ambas reglas se validan en la aplicacion y la unicidad tambien se protege con un indice unico en PostgreSQL.
- Migraciones nuevas: `20260809120000_add_product_short_description` y `20260809120500_prevent_duplicate_product_reviews`.

## 17. Aviso de Privacidad Integral

**Última actualización técnica:** Septiembre 2026. El texto legal debe ser validado por asesoría jurídica antes de publicarse como versión definitiva.

En cumplimiento con la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)** de México, **TECNOTITLÁN** (en adelante "El Sitio"), pone a su disposición el presente Aviso de Privacidad.

### 17.1. Identidad y domicilio del responsable
El responsable del tratamiento de sus datos personales es la administración de **TECNOTITLÁN**. Para efectos de este aviso, señalamos como medio de contacto nuestro formulario de atención al cliente y el correo electrónico de soporte visible en el sitio.

### 17.2. Datos personales recabados
Para procesar sus pedidos y brindarle servicio, recabamos los siguientes datos:
*   **Datos de Identificación:** Nombre completo.
*   **Datos de Contacto:** Correo electrónico, número de teléfono móvil, dirección de envío y facturación.
*   **Datos Financieros:** Información de pago procesada mediante Stripe o la plataforma externa seleccionada, como Mercado Libre. **El Sitio NO almacena números completos de tarjetas de crédito.**

### 17.3. Finalidades del tratamiento
Sus datos serán utilizados para las siguientes finalidades:
*   **Primarias (Necesarias):** Procesamiento, envío y entrega de pedidos; facturación; contacto para aclaraciones sobre el servicio.
*   **Secundarias:** Envío de promociones, boletines informativos y encuestas de calidad (puede darse de baja en cualquier momento).

### 17.4. Transferencia de datos
Le informamos que, debido a nuestro modelo de operación logística, sus datos de envío (Nombre, Dirección, Teléfono) pueden ser compartidos con:
*   Proveedores logísticos y de paquetería (DHL, FedEx, Estafeta, etc.).
*   Almacenes y socios comerciales encargados del despacho de mercancía.

### 17.5. Derechos ARCO
Usted tiene derecho a **A**cceder, **R**ectificar, **C**ancelar u **O**ponerse al tratamiento de sus datos. Para ejercer estos derechos, envíe una solicitud a nuestro correo de soporte.
## 18. Términos y condiciones de uso

**Bienvenido a TECNOTITLÁN.**

Al acceder y utilizar este sitio web, usted acepta estar sujeto a los siguientes términos y condiciones.

### 18.1. Generalidades
Este sitio es operado por **TECNOTITLÁN**. Nos reservamos el derecho de rechazar la prestación de servicio a cualquier persona, por cualquier motivo y en cualquier momento.

### 18.2. Productos y servicios
*   **Disponibilidad:** Ciertos productos pueden estar disponibles exclusivamente en línea y tener cantidades limitadas.
*   **Precios:** Los precios de nuestros productos están sujetos a cambios sin previo aviso.

### 18.3. Envíos y tiempos de entrega
*   **Logística:** Trabajamos con proveedores nacionales e internacionales. Al realizar una compra, usted acepta que su pedido puede ser procesado y enviado directamente desde los almacenes de nuestros socios.
*   **Tiempos:** Los tiempos de envío son estimados y pueden variar según la ubicación y la temporada. El tiempo promedio de entrega es de **5 a 15 días hábiles**.

### 18.4. Política de devoluciones
Nuestra política tiene una duración de **30 días** a partir de la recepción del producto. Para ser elegible, el artículo debe estar sin usar y en las mismas condiciones en que lo recibió.

### 18.5. Ley aplicable
Estos Términos del Servicio se regirán e interpretarán de acuerdo con las leyes de **México**.

## 19. Registro de cambios funcionales

### Actualización 2026-08-20 - Publicación de productos en Mercado Libre

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
### Actualización 2026-08-23 - Vinculación estricta por SKU local

- Cada producto de Tecnotitlan mantiene una publicacion independiente en Mercado Libre con el mismo SKU local.
- Una publicacion remota solo puede reutilizarse cuando su `seller_custom_field` o atributo `SELLER_SKU` coincide exactamente con el SKU local.
- Si un producto guarda por error el ID de otra publicacion o el ID de una categoria, Tecnotitlan limpia solamente ese vinculo local y crea una publicacion nueva para el SKU correcto.
- La autocorreccion nunca elimina ni modifica la publicacion remota ajena. Por ejemplo, `AUR-002` permanece separado de cualquier reloj `WTC-*`.

### Actualización 2026-08-23 - Familia obligatoria de Mercado Libre

- La creacion de publicaciones envia `family_name` en la raiz del payload, como exige Mercado Libre.
- El valor se construye con marca y modelo, por ejemplo `G-Tide R9 Pro`, sin duplicar la marca.
- Si el formulario envia una familia explicita, ese valor tiene prioridad. Como respaldo se usa modelo, marca, nombre del producto o SKU.
- Cuando se usa `family_name`, Tecnotitlan no envia `title` en la misma solicitud porque Mercado Libre rechaza esa combinacion con `body.invalid_fields`.
- Los errores de Mercado Libre ahora decodifican entidades HTML y muestran causas, referencias y atributos invalidos cuando la API los proporciona.

### Actualización 2026-08-27 - Código universal GTIN/EAN/UPC

- Los productos pueden guardar un codigo universal `gtin` opcional de 8, 12, 13 o 14 digitos.
- El formulario administrativo permite capturarlo una sola vez y lo reutiliza al preparar y publicar en Mercado Libre.
- Si la categoria de Mercado Libre exige `GTIN`, Tecnotitlan lo envia como atributo de la publicacion y bloquea el envio con un mensaje claro cuando falta.
- La migracion `20260823000000_add_product_gtin` agrega la columna sin modificar productos existentes.

### Actualización 2026-08-27 - Categorías de Mercado Libre importadas en vivo

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

### Actualización 2026-08-28 - Cotización e imágenes de Mercado Libre

- Antes de publicar, Tecnotitlan consulta en vivo la comision y el costo de envio para la categoria, modalidad Clasica o Premium, precio, dimensiones y configuracion logistica de la cuenta.
- La pantalla muestra precio base, precio sugerido, comision, envio, otros cargos y neto estimado. El operador debe confirmar expresamente el desglose; el backend vuelve a calcularlo y aplica el precio sugerido, por lo que no confia en importes enviados por el navegador.
- En una publicacion vinculada, la sincronizacion manual confirmada aplica juntos el precio sugerido y el stock publicable. Las sincronizaciones automaticas de inventario conservan el precio remoto.
- Clasica se identifica como la opcion de menor comision y sin meses sin intereses; Premium ofrece mayor exposicion y meses sin intereses con una comision superior. La interfaz incluye ayuda contextual junto al selector.
- Las imagenes se cargan primero al servicio de imagenes de Mercado Libre. Solo se anexan las que Mercado Libre procesa con al menos 500 x 500 pixeles; los archivos pequenos o rechazados se omiten y se reportan como advertencia. Si ninguna imagen es valida, la publicacion se bloquea.
- Cuando se selecciona una ficha exacta de catalogo, sus imagenes oficiales se agregan a las imagenes propias sin duplicar IDs, hasta el limite de Mercado Libre.
- La cotizacion detecta cuando la cuenta conectada no reporta RFC y agrega la estimacion conservadora de retenciones maximas sobre la base sin IVA. Con RFC detectado muestra una advertencia porque el importe exacto depende del regimen validado por Mercado Libre.
- En publicaciones vinculadas, el costo de envio se consulta por `item_id` para utilizar las dimensiones logisticas efectivas de Mercado Libre. Al importar una venta de una sola pieza, las dimensiones del paquete remoto actualizan la ficha local para futuras simulaciones.

### Actualización 2026-08-28 - Guías de Mercado Envíos en pedidos

- Al recibir o releer una orden, Tecnotitlan consulta `/shipments/{shipping_id}` y guarda automaticamente destinatario, domicilio, telefono disponible, paqueteria, numero de guia, estado, modalidad logistica, costo, dimensiones y fecha estimada.
- Los webhooks de envios refrescan el pedido local sin esperar una captura manual.
- La tarjeta administrativa del pedido permite actualizar el envio y descargar/imprimir la etiqueta oficial PDF desde `/shipment_labels` cuando el envio ME2 esta `ready_to_ship` y `ready_to_print` o `printed`.
- Las etiquetas no se inventan ni se almacenan como documentos propios: se solicitan autenticadas a Mercado Libre y se entregan al operador para impresion.

### Actualización 2026-08-28 - Reclamos, devoluciones y comunicaciones Mercado Libre

- El Centro de Reclamos conserva expediente, pedido relacionado, plazo oficial, impacto en reputacion, devolucion, rastreo, costo, estado del dinero, inspeccion y bitacora de acciones.
- Los webhooks `post_purchase`, `claims` y `claims_actions` actualizan el expediente; las acciones monetarias o de resolucion solo se habilitan cuando Mercado Libre las reporta disponibles y exigen confirmacion del folio.
- La bandeja **Mensajes ML** unifica preguntas preventa y conversaciones posventa sin mezclar sus reglas.
- Las preguntas se sincronizan desde `/questions/search`, se vinculan por `meliItemId` al producto local y se responden mediante `/answers`. Los webhooks `questions` mantienen el estado actualizado.
- Los mensajes posventa se consultan por paquete con `mark_as_read=false`, se relacionan con el pedido importado y solo se marcan como leidos cuando el operador lo solicita.
- Tecnotitlan solo permite responder una conversacion posventa activa iniciada por el comprador. No envia mensajes automaticos repetitivos ni inicia contactos fuera del flujo autorizado por Mercado Libre.
- Los webhooks `messages` recuperan el mensaje notificado y resincronizan la conversacion completa. Como respaldo, la bandeja consulta preguntas y pendientes al abrirse. La interfaz muestra contador, alerta sonora disponible, responsable, estado interno y trazabilidad.
- El texto posventa respeta el limite dinamico informado por Mercado Libre, normalmente 350 caracteres. La implementacion reconoce la ruta de agentes de mensajeria y conserva compatibilidad con conversaciones anteriores.
- Las tablas `meli_questions`, `meli_post_sale_conversations`, `meli_post_sale_messages` y `meli_communication_activities` separan los datos operativos, mensajes y auditoria.

### Actualización 2026-08-30 - Bandeja unificada ligada al pedido

- La ruta administrativa **Atencion > Bandeja unificada** reúne WhatsApp, tickets de soporte y correo, preguntas y mensajes posventa de Mercado Libre, reclamos y conversaciones escaladas de Tecatl.
- Cada expediente muestra en la misma vista el historial del canal, estado, prioridad, cliente y el contexto comercial del pedido: numero, estado, canal de venta, total y productos con SKU.
- Los pedidos nativos de Mercado Libre quedan confirmados por su relacion de origen. En otros canales sólo se sugieren coincidencias exactas por usuario, correo completo o los 10 digitos del telefono; la sugerencia no se persiste ni se considera confirmada hasta que un operador la acepta.
- El operador puede buscar por numero de pedido, cliente, telefono, SKU o folio externo, confirmar o cambiar el vínculo y quitar un vínculo manual. Un vínculo manual siempre tiene prioridad sobre cualquier sugerencia automatica.
- Las respuestas se envian mediante el canal original y respetan sus reglas: WhatsApp, correo de soporte, respuestas preventa, mensajes posventa, reclamos o escalamiento Tecatl. El backend vuelve a validar permisos por origen y el estado que permita responder.
- Las tablas `unified_inbox_links` y `unified_inbox_replies` conservan los vínculos confirmados y la trazabilidad de respuestas. Ninguna coincidencia parcial o difusa vincula automaticamente datos de clientes distintos.
- El menú muestra un contador agregado y recibe invalidaciones por Socket.IO; el sondeo de cinco minutos recupera desconexiones prolongadas.

### Actualización 2026-08-30 - Inspección y cuarentena de devoluciones

- La ruta **Atencion > Devoluciones y cuarentena** controla la recepcion fisica de devoluciones asociadas a un pedido y, cuando corresponde, a un reclamo de Mercado Libre.
- Al recibir un paquete se registra ubicacion de cuarentena, condicion del empaque, sello, evidencia, notas y cantidades reales por producto. La recepcion no modifica `Product.countInStock` ni el stock de ningun marketplace.
- Cada pieza conserva pedido, SKU, cantidad esperada y recibida, numeros de serie, evidencia fotografica, hallazgos y una lista obligatoria de verificacion: serie, accesorios, funcionamiento, estetica y empaque.
- Los dictamenes disponibles son: mantener en cuarentena, reintegrar a bodega, reacondicionar, devolver a proveedor o dar de baja. No puede aplicarse un destino final mientras falten piezas por inspeccionar, condicion fisica, checklist o evidencia/notas suficientes.
- Unicamente **Reintegrar a bodega** crea un movimiento `RETURN_IN` con `referenceType=RETURN_INSPECTION` y aumenta el stock Web/bodega. Dañados, incompletos, reacondicionamiento, proveedor y baja nunca se vuelven vendibles automaticamente.
- La finalizacion es idempotente por pieza: repetir la solicitud no duplica inventario. El expediente guarda quién recibio, quién finalizo, fechas y ubicacion; el reclamo Mercado Libre recibe el resultado de inspeccion y una actividad de auditoria.
- Las recepciones parciales estan permitidas, pero la suma de todos los expedientes nunca puede superar la cantidad vendida en el pedido.

### Actualización 2026-08-30 - SLA, alertas, plantillas y calidad

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

### Actualización 2026-08-30 - Cifrado de tokens, auditoría y 2FA

- Los tokens de acceso y renovacion de Mercado Libre y TikTok Shop se guardan con AES-256-GCM. Cada valor usa un nonce aleatorio y etiqueta de autenticidad; el prefijo versionado `enc:v1` permite rotaciones futuras sin confundir texto antiguo con ciphertext.

### Actualización 2026-08-30 - Sincronización en tiempo real sin recargar

- El backend publica invalidaciones por Socket.IO despues de cada mutacion exitosa. Los temas separan Mercado Libre, pedidos, productos, inventario, devoluciones, bandeja, calidad, usuarios, seguridad, finanzas y dashboard.
- Los webhooks de Mercado Libre avisan solamente despues de terminar su procesamiento; asi la interfaz no consulta datos anteriores mientras una orden, reclamo o cambio de publicacion sigue en proceso.
- La interfaz vuelve a consultar por AJAX solamente los recursos afectados y agrupa eventos cercanos con una espera corta. No recarga la pagina completa ni pierde formularios, filtros o la imagen activa de un producto.
- Catalogo, ficha de producto, pedidos del cliente y panel administrativo reciben cambios en vivo. Los sondeos quedan como respaldo cada cinco minutos para recuperarse de una desconexion prolongada.
- Los sockets autentican el JWT y su version de sesion. Un evento solo contiene el tema y la accion; los datos reales se leen por los endpoints normales, donde aplican RBAC y pertenencia del pedido. El QR de WhatsApp se limita a superadministradores y nunca se transmite el contenido completo de un mensaje como invalidacion.
- El panel muestra `Tiempo real activo` o `Reconectando` para que el operador sepa si esta recibiendo cambios inmediatos.
- Al arrancar, la API migra de forma compatible cualquier token heredado en texto claro y elimina tokens, secretos y contrasenas duplicados dentro de `rawData`. Las conexiones existentes se conservan; la aplicacion descifra únicamente en memoria cuando llama al proveedor.
- La clave se deriva de `TOKEN_ENCRYPTION_KEY`; como compatibilidad operativa usa `SESSION_SECRET` o `JWT_SECRET`. Cambiar la clave sin un proceso de rotacion vuelve ilegibles los tokens almacenados.
- Cada usuario puede activar TOTP desde **Seguridad y 2FA** mediante QR o clave manual. La activacion exige la contrasena actual y un codigo valido; se entregan diez codigos de recuperacion de un solo uso, almacenados únicamente como hashes.
- El login con 2FA usa un reto JWT de cinco minutos y no entrega una sesion completa hasta validar TOTP o un codigo de recuperacion. Activar/desactivar 2FA o cambiar la contrasena incrementa `tokenVersion` e invalida sesiones anteriores.
- `audit_logs` registra mutaciones autenticadas, accesos y cambios de seguridad con actor, accion, categoria, resultado, ruta y fecha. No copia cuerpos de solicitudes, contrasenas ni tokens; la IP se convierte en una huella HMAC irreversible.
- Cada usuario consulta su actividad reciente. El Super Admin dispone de **Administracion > Seguridad y auditoria** con los últimos eventos operativos y administrativos.

### Actualización 2026-08-31 - Desenlace de reclamos en bandeja unificada

- Los reclamos cerrados de Mercado Libre muestran una resolución de sistema dentro de la conversación: beneficiario, motivo, quién cerró el caso, cobertura aplicada, cancelación del pedido y estado monetario disponible.
- Cuando Mercado Libre relaciona un reclamo con un `shipment` en lugar de una orden, Tecnotitlan busca el pedido local por `shippingInfo.shippingId` y recupera su orden externa. Esto evita expedientes cerrados sin contexto comercial.
- Un reclamo cerrado sin devolución física pendiente pasa a control interno `RESOLVED`. Los casos que todavía requieren recibir o inspeccionar mercancía conservan su flujo de cuarentena.
- La bandeja no inventa un reembolso: muestra fecha o estado del dinero sólo si Mercado Libre los reporta. Si la orden cancelada deja de tener un pago vigente, lo expresa con ese alcance exacto.

### Actualización 2026-08-31 - Secciones y alertas de la bandeja unificada

- La Bandeja unificada se divide en **Casos importantes** y **Conversaciones**. La primera sección contiene reclamos, cancelaciones y devoluciones; la segunda reúne preguntas preventa y mensajes privados o posventa.
- Cada expediente recibe una clasificación visible y contadores por sección y tipo. Los filtros conservan búsqueda, canal, estado pendiente, SLA y contexto del pedido.
- Las cancelaciones de pedidos Mercado Libre aparecen aunque no exista un reclamo asociado. Si el reclamo ya está ligado al pedido cancelado se muestra un solo expediente, evitando duplicar el caso.
- Los reclamos, cancelaciones y reembolsos notifican al equipo. El correo usa destinatarios individuales; Baileys usa exclusivamente el grupo y deduplica por evento.
- Las resincronizaciones o webhooks repetidos no generan avisos duplicados. La notificación lleva al operador directamente a la Bandeja unificada, donde puede revisar pedido, dinero, inventario y fechas límite.

### Actualización 2026-08-31 - Alertas críticas en dashboard

- El dashboard administrativo muestra una tarjeta roja pulsante cuando existe un reclamo abierto o un reembolso confirmado pendiente de revisión. La animación respeta `prefers-reduced-motion` para accesibilidad.
- Las alertas llegan en tiempo real, muestran pedido y resumen del evento, y enlazan con la Bandeja unificada para atender el expediente.
- **Marcar revisado** registra actor, fecha y tipo de alerta en la actividad del reclamo. El acuse sólo indica que un integrante del equipo vio el evento; no cambia el estado del reclamo ni lo declara resuelto.
- Reclamo y reembolso usan acuses independientes. Haber revisado el reclamo no oculta un reembolso que Mercado Libre confirme posteriormente.

### Actualización 2026-08-31 - Operación completa de incidencias críticas

- Cada reclamo o reembolso se autoasigna al vendedor con menor carga de asignaciones durante los últimos 30 días. Si no hay vendedores, se asigna a un rol administrativo. Un administrador distinto queda como suplente cuando existe y ambos responsables se pueden cambiar desde el dashboard.
- El monitor operativo escala un caso sin acuse a los 15 minutos hacia responsable y suplente. A los 30 minutos genera una segunda escalación para `SUPER_ADMIN`, `ADMIN` y `SUPERVISOR`. Cada nivel se registra una sola vez en la actividad del reclamo.
- El dashboard incorpora métricas de los últimos 30 días: reclamos, reembolsos, importe reembolsado, casos sin responsable, tiempo promedio de acuse y expedientes escalados.
- La conciliación automática separa el reembolso al comprador de la exposición del vendedor. Muestra comisión de venta, costo real o estimado de envío, costo de devolución, costo del inventario aún no reintegrado y exposición máxima estimada.
- Para el envío se consulta `/shipments/{shipment_id}/costs` y se utiliza `senders[].cost`, que representa el cargo final del vendedor. La comisión se obtiene de `sale_fee` por artículo cuando el resumen local no la contiene.
- Una comisión o envío no se presenta como recuperado hasta que exista evidencia de abono en la facturación de Mercado Libre. Mientras tanto aparece como pendiente de conciliación, evitando registrar una ganancia inexistente.
- El panel muestra la salud de WhatsApp y enlaza a la configuración protegida cuando no existe sesión. También permite activar avisos del navegador; con permiso concedido, una alerta crítica nueva produce sonido, notificación y contador rojo en Dashboard aun si el operador navega en otro módulo del panel.
- Sin una sesión WhatsApp guardada no se intenta generar QR de manera repetitiva. El Super Admin debe abrir **Configuración > WhatsApp**, iniciar la conexión y escanear el QR desde el teléfono una sola vez.

### Actualización 2026-09-01 - Seguridad, operación por rol y frontend Vite

- La sesion de usuario se entrega exclusivamente mediante una cookie `HttpOnly`, `Secure` en produccion y `SameSite=Lax`, con vigencia de ocho horas. El navegador ya no guarda ni adjunta el JWT desde `localStorage`; cerrar sesion invalida tambien la version del token en servidor.
- El personal administrativo y operativo debe completar 2FA antes de entrar al panel. Mientras lo configura, la sesion solamente permite abrir Seguridad, consultar el perfil y cerrar sesion. Los clientes pueden activar TOTP de forma opcional.
- Las contrasenas nuevas y los cambios de contrasena exigen al menos doce caracteres. Las paginas legales se limpian con una lista permitida en backend y vuelven a sanitizarse en el navegador antes de renderizar HTML.
- Las credenciales configurables marcadas como secreto se guardan cifradas con AES-256-GCM. Produccion debe definir una clave estable e independiente en `TOKEN_ENCRYPTION_KEY`; no debe rotarse sin migrar previamente los valores almacenados.
- Los avisos administrativos por Baileys se envían a un único grupo definido por `WHATSAPP_ADMIN_GROUP_JID`; Cloud API queda inactivo y diferido.
- **Mi trabajo** es la entrada principal del panel y resume, segun permisos, pedidos por preparar, reclamos abiertos y mensajes pendientes. **Bandeja unificada** queda como centro de atencion; WhatsApp, Mercado Libre, correo y Tecatl permanecen como herramientas especializadas.
- El panel administrativo incorpora un menu lateral adaptable a telefono, barra superior movil, fondo de cierre y accesos rapidos. El menu conserva RBAC y oculta modulos sin permiso.
- El frontend fue migrado de Create React App a Vite. El contenedor sigue generando `build/`, admite variables `REACT_APP_*` y conserva `env.js` para configuración en tiempo de ejecución.
- La configuracion Nginx agrega HSTS, CSP, proteccion contra MIME sniffing, politica de referentes, permisos del navegador y restricciones de iframe. Los recursos de pagos, reCAPTCHA y contenido autorizado permanecen declarados de forma explicita.

### Actualización 2026-09-08 - Estabilización Baileys y monitoreo

- Baileys `7.0.0-rc13` queda fijado; no se adoptan `rc14`, `master` ni PRs abiertas.
- Gateway único PN→LID: un envío por operación para texto, multimedia y grupo.
- 463 abre el circuito tanto síncrono como desde `messages.update`, sin logout, QR ni retry.
- Caché verificada de versión WA Web evita bucles 408 por datos obsoletos.
- Alertas de Técatl y pagos internos usan un solo grupo Baileys.
- Migración `20260907190000_whatsapp_delivery_observability` añade trazabilidad de operación e identidad.
- Sentry `10.73.0` está integrado en Node y React sin PII. Sin DSN queda inactivo y Seguridad lo marca pendiente.
- Verificación: 111 pruebas backend, build Vite, Prisma válido y cero vulnerabilidades en `npm audit`.
- No se ejecutó QR, vinculación, logout, envío real ni despliegue durante esta estabilización.
