# d:/Tecnotitlan/Tecnotitlan/Dockerfile

# --- Fase 1: Construcción (Builder) ---
# Esta fase instala TODAS las dependencias (incluyendo devDependencies)
# y construye los artefactos necesarios, como el cliente de Prisma.
FROM node:18-alpine AS builder

WORKDIR /app

# 1. Copia los archivos de definición de paquetes.
COPY package*.json ./

# 2. [CORRECCIÓN CLAVE] Copia la carpeta de Prisma para que el schema esté disponible.
# Esto debe ocurrir ANTES de `npm install`.
COPY backend/prisma/ ./prisma/

# 3. [CORRECCIÓN CLAVE] Instala TODAS las dependencias.
# Se elimina el flag `--only=production` para que `prisma` se instale
# y el script `postinstall` ("prisma generate") pueda ejecutarse.
RUN npm install

# 4. Copia el resto del código fuente de la aplicación.
COPY . .

# --- Fase 2: Ejecución (Runner) ---
# Esta fase crea una imagen más ligera solo con lo necesario para correr la app.
FROM node:18-alpine

WORKDIR /app

# 5. [CORRECCIÓN CLAVE] Copia los artefactos desde la fase 'builder'.
# Copiamos solo lo estrictamente necesario para EJECUTAR la aplicación.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/ .

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]