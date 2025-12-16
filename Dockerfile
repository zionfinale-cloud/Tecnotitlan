# --- Etapa 1: Builder ---
# Esta etapa instala dependencias y prepara el código para producción.
FROM node:18-slim AS builder

WORKDIR /app

# Evita que Puppeteer descargue su propia versión de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia primero los archivos de definición de paquetes para optimizar la caché de Docker.
COPY package*.json ./

# Copia el resto del código fuente del backend.
COPY backend/ ./backend/

# Establece el directorio de trabajo dentro del backend.
WORKDIR /app/backend

# Instala las dependencias y genera el cliente de Prisma.
RUN npm install --force

# --- Etapa 2: Ejecución (final) ---
# Esta es la imagen final, optimizada y ligera para producción.
FROM node:18-slim AS final

WORKDIR /app/backend

# Instala las dependencias de sistema necesarias para Puppeteer/whatsapp-web.js en Debian.
# Debian (en la que se basa 'slim') ya incluye las librerías OpenSSL que Prisma necesita.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copia los artefactos construidos desde la etapa 'builder'.
COPY --from=builder /app/backend ./

EXPOSE 5000

CMD [ "node", "src/index.js" ]