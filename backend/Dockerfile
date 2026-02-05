# --- Etapa 1: Dependencias (deps) ---
# Esta etapa solo instala las dependencias para optimizar la caché.
FROM node:18-slim AS deps

WORKDIR /app

# Evita que Puppeteer descargue su propia versión de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Instala OpenSSL (necesario para Prisma Client en Debian Slim)
RUN apt-get update -y && apt-get install -y openssl

# Copia los archivos de dependencias y el esquema de Prisma.
COPY package*.json ./
COPY backend/prisma ./backend/prisma/

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

# Instala las dependencias de sistema necesarias para Puppeteer/whatsapp-web.js en Debian.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copia solo los artefactos necesarios del backend desde la etapa 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend ./backend

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]