# d:/Tecnotitlan/Tecnotitlan/Dockerfile

# --- Fase 1: Construcción (Builder) ---
# Instala dependencias y genera el cliente de Prisma.
FROM node:18-alpine AS builder

WORKDIR /app

# [OPTIMIZACIÓN] Variable de entorno para saltar la descarga de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia solo los archivos de definición de paquetes para cachear la capa de node_modules.
COPY package*.json ./

# Copia el schema de Prisma para que `prisma generate` funcione.
COPY backend/prisma/ ./prisma/

# Instala TODAS las dependencias para que el script `postinstall` de Prisma se ejecute.
# Usamos --force para evitar problemas con peer dependencies y nos aseguramos de instalar todo.
RUN npm install --force

# Copia el resto del código fuente. Esto se hace DESPUÉS de npm install para que los cambios
# en el código no invaliden la caché de las dependencias, haciendo los builds más rápidos.
COPY . .

WORKDIR /app

# [CRÍTICO] Instala Chromium desde el gestor de paquetes de Alpine. Es mucho más ligero.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia solo los artefactos necesarios desde la fase 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/ .

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]