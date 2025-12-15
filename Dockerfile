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

# CRÍTICO: Copia solo las carpetas y archivos necesarios para la construcción.
# Esto evita el error de dependencia circular al no copiar el contexto de build de Docker.
COPY ./backend ./backend
COPY ./frontend ./frontend
COPY ./prisma ./prisma

# --- Fase 2: Ejecución (Runner) ---
# Crea la imagen final y ligera para producción.
FROM node:18-alpine

WORKDIR /app

# Instala la versión de Chromium de Alpine Linux, que es mucho más ligera.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia solo los artefactos necesarios desde la fase 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 5000

# CRÍTICO: Copiamos la carpeta del backend desde el contexto original.
COPY ./backend ./backend
CMD [ "node", "backend/src/index.js" ]