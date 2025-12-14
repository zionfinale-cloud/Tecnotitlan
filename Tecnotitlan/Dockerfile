# d:/Tecnotitlan/Tecnotitlan/Dockerfile

# --- Fase 1: Construcción (Builder) ---
# Esta fase instala dependencias y prepara los artefactos de la aplicación.
FROM node:18-alpine AS builder

WORKDIR /app

# Evita que Puppeteer descargue su propia versión de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia los archivos de definición de paquetes.
COPY package*.json ./

# Instala TODAS las dependencias.
RUN npm install --force

# Copia el resto del código fuente.
COPY . .


# --- Fase 2: Ejecución (Runner) ---
# Esta es la imagen final, optimizada y ligera que se ejecutará en producción.
FROM node:18-alpine

WORKDIR /app

# Instala la versión de Chromium de Alpine Linux, que es mucho más ligera.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia solo los artefactos necesarios desde la fase 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend ./backend

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]