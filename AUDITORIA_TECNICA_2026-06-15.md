# Auditoria tecnica de Tecnotitlan

Fecha: 15 de junio de 2026

## Diagnostico

El proyecto si tiene una base utilizable: frontend React, API Express, PostgreSQL
con Prisma, RBAC, catalogo, pedidos e inicios de integraciones. El principal
problema no era una sola falla, sino la mezcla de varias migraciones de
infraestructura y dos arquitecturas de datos.

Se encontraron:

- Modelos Mongo/Mongoose heredados dentro del backend Prisma.
- Componentes React y pruebas Cypress colocados dentro del backend.
- Dos manifiestos de backend con comandos distintos.
- Builds y archivos `.env` rastreados por Git.
- Dockerfile incompatible con su propio contexto de Docker Compose.
- Suite Jest rota y peligrosa: usaba la base configurada y borraba tablas.
- Sesiones PostgreSQL configuradas con una opcion que `connect-pg-simple` ignora.
- Webhook n8n fijado a una URL local de prueba.
- Configuraciones completas expuestas por un endpoint publico.
- Endpoint de estado de WhatsApp sin autenticacion.
- Credenciales administrativas predeterminadas en el seed.

## Cambios aplicados

- Se retiro codigo heredado sin referencias activas y ejemplos de Cypress.
- Se dejaron de versionar secretos, builds y datos locales.
- Se agregaron `.env.example`, README y comandos coherentes desde la raiz.
- Se corrigieron Dockerfile, Docker Compose, sesiones, CORS y cookies.
- Se hizo configurable el webhook de n8n.
- Se protegieron rutas de configuracion y WhatsApp.
- Se creo un endpoint publico con lista permitida para apariencia y paginas legales.
- Se eliminaron credenciales administrativas predeterminadas.
- Se marco la documentacion maestra como contexto historico.

## Arquitectura recomendada

```text
Cloudflare Pages (frontend)
          |
          v
Render Web Service pagado (API Express)
          |
          +--> Supabase PostgreSQL
          +--> Cloudinary/R2 para imagenes
          +--> n8n separado
          +--> Proveedores de pago y marketplaces
```

No ejecutar frontend, API, n8n y WhatsApp en el mismo proceso. Baileys y n8n
necesitan persistencia y deben poder reiniciarse sin tumbar el checkout.

## Hospedaje recomendado

### Opcion principal: servicios administrados

- Frontend en Cloudflare Pages.
- API en Render, instancia pagada siempre activa.
- PostgreSQL en Supabase Pro al comenzar a recibir pedidos reales.
- n8n en un servicio separado con disco persistente o n8n Cloud.
- Imagenes en Cloudinary o almacenamiento de objetos.

Es la opcion recomendada porque reduce mantenimiento, permite despliegues
automaticos y separa fallas. No usar el nivel gratuito de Render para produccion:
se suspende por inactividad.

### Opcion economica: VPS con Docker Compose

Un Droplet de DigitalOcean puede alojar API y n8n, manteniendo Supabase y
Cloudflare aparte. Cuesta menos, pero requiere administrar Linux, respaldos,
actualizaciones, firewall, monitoreo y recuperacion. Es mejor que cPanel para
Node.js, pero no es la opcion de menor trabajo operativo.

## Prioridades antes de vender

1. Rotar todos los secretos que estuvieron versionados en Git.
2. Crear una base de staging separada y reconstruir pruebas automatizadas.
3. Desplegar frontend y API en servicios separados.
4. Probar registro, login, catalogo, carrito, checkout y pago con sandbox.
5. Definir fuente maestra de inventario y reglas contra sobreventa.
6. Completar primero Mercado Libre; despues Amazon y TikTok Shop.
7. Agregar monitoreo, respaldos y alertas antes de activar pagos reales.

## Estrategia omnicanal

La web propia debe ser el centro del catalogo, costos, inventario y pedidos. Cada
marketplace debe tratarse como un adaptador independiente. No conviene completar
Mercado Libre, Amazon y TikTok Shop al mismo tiempo: primero se estabiliza la
tienda propia y un canal, se documentan reglas de sincronizacion y luego se
replica el patron.
