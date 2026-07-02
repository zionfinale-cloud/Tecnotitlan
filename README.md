# Tecnotitlan

Plataforma de comercio electronico omnicanal para vender desde la tienda propia y
sincronizar catalogo, inventario y pedidos con marketplaces.

## Estructura vigente

- `frontend/`: tienda y panel administrativo en React.
- `backend/`: API Express, Prisma, PostgreSQL e integraciones.
- `DOCUMENTACION_MAESTRA_TECNOTITLAN.md`: contexto historico y funcional.

PostgreSQL con Prisma es la unica capa de datos vigente. Los modelos antiguos de
MongoDB/Mongoose fueron retirados.

## Desarrollo local

1. Copiar `backend/.env.example` a `backend/.env` y completar las variables.
2. Copiar `frontend/.env.example` a `frontend/.env` y completar las variables.
3. Instalar dependencias:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

4. Generar Prisma y arrancar cada aplicacion:

```bash
npm run prisma:generate
npm run dev:backend
npm run dev:frontend
```

## Produccion recomendada

- Frontend: hosting estatico con CDN.
- Backend y n8n: servicios separados en contenedores.
- Base de datos: PostgreSQL administrado.
- Imagenes: almacenamiento de objetos/Cloudinary, no disco local.

No se deben versionar `.env`, builds, credenciales de WhatsApp ni archivos
subidos por usuarios. Los secretos que alguna vez estuvieron en Git deben
rotarse antes del siguiente despliegue.
