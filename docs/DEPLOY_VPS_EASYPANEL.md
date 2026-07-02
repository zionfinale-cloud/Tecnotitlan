# Despliegue Tecnotitlan en VPS con EasyPanel

Objetivo: correr Tecnotitlan en un VPS con Docker/EasyPanel, Cloudflare y Supabase/PostgreSQL externo.

## Arquitectura inicial

- `tecnotitlan.com.mx`: frontend React servido por Nginx.
- `api.tecnotitlan.com.mx`: backend Node/Express.
- `n8n.tecnotitlan.com.mx`: automatizaciones.
- Base de datos: Supabase/PostgreSQL externo.
- Uploads: Cloudinary recomendado.
- DNS/SSL: Cloudflare + certificados del proxy de EasyPanel.

## Lo que debe entregar el proveedor del VPS

- Ubuntu Server 24.04 LTS.
- EasyPanel instalado y funcionando.
- Acceso root SSH.
- Acceso admin a EasyPanel.
- IP publica dedicada.
- Puertos 22, 80, 443 y puerto del panel abiertos.
- Docker funcionando.
- Opcion de reiniciar/reinstalar VPS.

## DNS en Cloudflare

Cuando tengamos la IP del VPS:

```text
A     @       IP_DEL_VPS
A     www     IP_DEL_VPS
A     api     IP_DEL_VPS
A     n8n     IP_DEL_VPS
```

Al inicio usa:

- `@` y `www`: proxied.
- `api` y `n8n`: DNS only mientras emitimos SSL y probamos.

Luego podemos pasar `api` a proxied si todo responde bien.

En SSL/TLS:

```text
Full
```

Cuando EasyPanel tenga certificados validos:

```text
Full (strict)
```

## Variables

Usa `.env.vps.example` como checklist. No subas un `.env` real al repo.

Minimo para arrancar API:

```text
NODE_ENV=production
PORT=5000
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
CLIENT_URL_PRIMARY=https://tecnotitlan.com.mx
CLIENT_URL_SECONDARY=https://www.tecnotitlan.com.mx
```

Minimo para frontend:

```text
REACT_APP_API_URL=https://api.tecnotitlan.com.mx
GENERATE_SOURCEMAP=false
```

Minimo para n8n:

```text
N8N_HOST=n8n.tecnotitlan.com.mx
N8N_EDITOR_BASE_URL=https://n8n.tecnotitlan.com.mx
N8N_WEBHOOK_URL=https://n8n.tecnotitlan.com.mx
N8N_ENCRYPTION_KEY=
```

## Opcion A: servicios separados en EasyPanel

Esta opcion es la mas facil de operar desde panel.

### Servicio API

- Tipo: Dockerfile / Git repository.
- Root/context: `backend`.
- Dockerfile: `Dockerfile`.
- Puerto interno: `5000`.
- Dominio: `api.tecnotitlan.com.mx`.
- Variables: backend desde `.env.vps.example`.

Despues del primer deploy, entrar al shell del contenedor o usar comando de EasyPanel:

```bash
npx prisma migrate deploy --schema=./prisma/schema.prisma
npm run seed:import
```

### Servicio Web

- Tipo: Dockerfile / Git repository.
- Root/context: `frontend`.
- Dockerfile: `Dockerfile`.
- Puerto interno: `80`.
- Dominio: `tecnotitlan.com.mx`.
- Build args:
  - `REACT_APP_API_URL=https://api.tecnotitlan.com.mx`
  - `GENERATE_SOURCEMAP=false`

Agregar dominio adicional:

```text
www.tecnotitlan.com.mx
```

### Servicio n8n

- Tipo: App/Image Docker.
- Imagen: `n8nio/n8n:latest`.
- Puerto interno: `5678`.
- Dominio: `n8n.tecnotitlan.com.mx`.
- Volumen persistente: `/home/node/.n8n`.
- Variables: bloque n8n de `.env.vps.example`.

## Opcion B: Docker Compose

Tambien se puede usar `compose.vps.yml` si EasyPanel permite crear proyecto por Compose.

Variables necesarias:

```text
.env.vps.example -> variables del proyecto en EasyPanel
```

Puertos internos:

- API: `5000`
- Web: `3000` en host, `80` en contenedor
- n8n: `5678`

## Orden correcto

1. Crear DNS en Cloudflare.
2. Crear API en EasyPanel.
3. Configurar variables de API.
4. Desplegar API.
5. Ejecutar migraciones:
   ```bash
   npx prisma migrate deploy --schema=./prisma/schema.prisma
   ```
6. Ejecutar seed:
   ```bash
   npm run seed:import
   ```
7. Probar:
   ```text
   https://api.tecnotitlan.com.mx
   https://api.tecnotitlan.com.mx/api/products
   https://api.tecnotitlan.com.mx/api/categories
   ```
8. Crear frontend.
9. Crear n8n.
10. Configurar webhooks del backend hacia n8n.
11. Probar login admin, productos, carrito, contacto y tickets.

## Checklist de produccion inicial

- [ ] API responde.
- [ ] Frontend carga.
- [ ] SSL activo.
- [ ] Login admin funciona.
- [ ] Migraciones aplicadas.
- [ ] Seed aplicado.
- [ ] CORS permite solo dominios reales.
- [ ] `.env` real no esta en Git.
- [ ] n8n tiene volumen persistente.
- [ ] `N8N_ENCRYPTION_KEY` guardado.
- [ ] Cloudinary configurado antes de subir imagenes reales.
- [ ] SMTP configurado antes de abrir registros a clientes.

## Notas

- Mantener Supabase/PostgreSQL externo al inicio simplifica backups y reduce carga del VPS.
- No activar pagos reales hasta hacer compra completa en modo prueba.
- No usar el disco local para imagenes de catalogo en produccion.
- Si se cambia `REACT_APP_API_URL`, hay que reconstruir el frontend.
