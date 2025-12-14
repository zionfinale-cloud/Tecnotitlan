# --- Fase 1: Construcción (Builder) ---
# Instala dependencias y genera el cliente de Prisma.
FROM node:18-alpine AS builder

WORKDIR /app

# Evita que Puppeteer descargue su propia versión de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia los archivos de definición de paquetes.
COPY package*.json ./

# Instala TODAS las dependencias.
RUN npm install --force

# --- Fase 2: Ejecución (Runner) ---
# Crea la imagen final y ligera para producción.
FROM node:18-alpine

WORKDIR /app

# Instala la versión de Chromium de Alpine Linux, que es mucho más ligera.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia solo los artefactos necesarios desde la fase 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
# CRÍTICO: Copiamos solo la carpeta del backend, que es lo que se necesita para correr.
COPY --from=builder /app/backend ./backend

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]