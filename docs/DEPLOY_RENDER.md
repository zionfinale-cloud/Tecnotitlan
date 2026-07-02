# Despliegue inicial en Render

Este despliegue esta pensado para salir de cPanel y tener Tecnotitlan en linea rapido, sin casarnos todavia con la infraestructura final.

## Recomendacion

- Frontend: Render Static Site (`tecnotitlan-web`).
- Backend: Render Web Service con Docker (`tecnotitlan-api`).
- Base de datos: Supabase/PostgreSQL separado para staging o produccion.
- Archivos: Cloudinary o Supabase Storage. No usar disco local del servidor.
- Dominios iniciales:
  - `https://tecnotitlan-web.onrender.com`
  - `https://tecnotitlan-api.onrender.com`

## Antes de crear los servicios

1. Confirmar que el repo en GitHub tiene los ultimos cambios.
2. Crear o elegir una base PostgreSQL/Supabase.
3. Tener listas estas variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - credenciales SMTP
   - credenciales Cloudinary
   - claves de pago solo si se van a probar pagos

## Orden correcto

1. Subir cambios a GitHub.
2. En Render, crear Blueprint desde `render.yaml`.
3. Configurar todas las variables marcadas como `sync: false`.
4. Desplegar primero `tecnotitlan-api`.
5. Ejecutar migraciones Prisma:
   ```bash
   npm run prisma:deploy
   ```
6. Ejecutar seed para crear/verificar admin:
   ```bash
   npm run seed:import
   ```
7. Desplegar `tecnotitlan-web`.
8. Probar:
   - `/api/products`
   - `/api/categories`
   - login admin
   - home
   - carrito
   - contacto/tickets

## Dominios reales

Cuando todo funcione:

- `tecnotitlan.com.mx` -> frontend.
- `api.tecnotitlan.com.mx` -> backend.

Despues de agregar dominios, actualizar:

- `CLIENT_URL_PRIMARY`
- `CLIENT_URL_SECONDARY`
- `REACT_APP_API_URL`
- `MERCADOLIBRE_REDIRECT_URI`
- `REACT_APP_MERCADOLIBRE_REDIRECT_URI`

## Notas importantes

- No guardar secretos en archivos `.env` dentro del repo.
- No usar WhatsApp/Baileys como proceso principal en Render hasta separar bien sesiones y almacenamiento.
- Para una tienda real, evitar el plan gratuito del backend porque puede dormir y tardar en despertar.
- Mantener auto deploy apagado al principio para controlar cada salida.
